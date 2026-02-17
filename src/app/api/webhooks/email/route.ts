import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Sanitize HTML to plain text with basic formatting
function sanitizeHtml(html: string): string {
  if (!html) return "";
  
  return html
    // Remove script and style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    // Convert common HTML elements to markdown-ish format
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<h[1-6][^>]*>/gi, "\n### ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "[$2]($1)")
    .replace(/<strong[^>]*>|<b[^>]*>/gi, "**")
    .replace(/<\/strong>|<\/b>/gi, "**")
    .replace(/<em[^>]*>|<i[^>]*>/gi, "_")
    .replace(/<\/em>|<\/i>/gi, "_")
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Verify SendGrid webhook signature
function verifySendGridSignature(
  publicKey: string,
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  try {
    const timestampedPayload = timestamp + payload;
    const decodedSignature = Buffer.from(signature, "base64");
    
    const verifier = crypto.createVerify("SHA256");
    verifier.update(timestampedPayload);
    
    return verifier.verify(
      `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
      decodedSignature
    );
  } catch {
    return false;
  }
}

// Verify Mailgun webhook signature
function verifyMailgunSignature(
  apiKey: string,
  timestamp: string,
  token: string,
  signature: string
): boolean {
  try {
    const encodedToken = crypto
      .createHmac("sha256", apiKey)
      .update(timestamp + token)
      .digest("hex");
    return encodedToken === signature;
  } catch {
    return false;
  }
}

// POST - Receive inbound email from email service
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    
    let emailData: {
      to: string;
      from: string;
      subject: string;
      text?: string;
      html?: string;
      attachments?: Array<{
        filename: string;
        content: string;
        contentType: string;
        size: number;
      }>;
    };

    // Parse based on content type (SendGrid vs Mailgun vs generic)
    if (contentType.includes("multipart/form-data")) {
      // Mailgun format
      const formData = await request.formData();
      
      // Verify Mailgun signature if configured
      const mailgunApiKey = process.env.MAILGUN_API_KEY;
      if (mailgunApiKey) {
        const timestamp = formData.get("timestamp") as string;
        const token = formData.get("token") as string;
        const signature = formData.get("signature") as string;
        
        if (!verifyMailgunSignature(mailgunApiKey, timestamp, token, signature)) {
          console.error("Invalid Mailgun signature");
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
      
      emailData = {
        to: (formData.get("recipient") as string) || (formData.get("To") as string) || "",
        from: (formData.get("sender") as string) || (formData.get("From") as string) || "",
        subject: (formData.get("subject") as string) || (formData.get("Subject") as string) || "No Subject",
        text: formData.get("body-plain") as string,
        html: formData.get("body-html") as string,
      };
    } else {
      // JSON format (SendGrid inbound parse or generic)
      const body = await request.json();
      
      // Verify SendGrid signature if configured
      const sendgridPublicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
      if (sendgridPublicKey) {
        const signature = request.headers.get("X-Twilio-Email-Event-Webhook-Signature") || "";
        const timestamp = request.headers.get("X-Twilio-Email-Event-Webhook-Timestamp") || "";
        
        if (!verifySendGridSignature(sendgridPublicKey, JSON.stringify(body), signature, timestamp)) {
          console.error("Invalid SendGrid signature");
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
      
      // SendGrid inbound parse webhook format
      if (Array.isArray(body)) {
        // SendGrid event webhook format
        for (const event of body) {
          if (event.event === "inbound") {
            emailData = {
              to: event.to || "",
              from: event.from || "",
              subject: event.subject || "No Subject",
              text: event.text,
              html: event.html,
            };
            break;
          }
        }
        if (!emailData!) {
          return NextResponse.json({ received: true });
        }
      } else {
        // Direct JSON format
        emailData = {
          to: body.to || body.envelope?.to?.[0] || "",
          from: body.from || body.envelope?.from || "",
          subject: body.subject || "No Subject",
          text: body.text || body["body-plain"],
          html: body.html || body["body-html"],
          attachments: body.attachments,
        };
      }
    }

    // Extract email address from "to" field (might be "Name <email@domain>" format)
    const toMatch = emailData.to.match(/<([^>]+)>/) || [null, emailData.to];
    const toEmail = toMatch[1]?.toLowerCase().trim();

    if (!toEmail) {
      console.error("No recipient email found");
      return NextResponse.json({ error: "No recipient" }, { status: 400 });
    }

    // Find the board by email address
    const boardEmail = await prisma.boardEmailAddress.findUnique({
      where: { email: toEmail },
      include: {
        board: {
          include: {
            columns: { orderBy: { position: "asc" } },
            members: { include: { user: true } },
            owner: true,
          },
        },
      },
    });

    if (!boardEmail) {
      console.error(`No board found for email: ${toEmail}`);
      return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
    }

    if (!boardEmail.isActive) {
      console.error(`Email-to-task disabled for board: ${boardEmail.boardId}`);
      return NextResponse.json({ error: "Email-to-task disabled" }, { status: 403 });
    }

    // Extract sender email
    const fromMatch = emailData.from.match(/<([^>]+)>/) || [null, emailData.from];
    const fromEmail = fromMatch[1]?.toLowerCase().trim() || emailData.from.toLowerCase().trim();

    // Check if sender is a board member (if required)
    const senderMember = boardEmail.board.members.find(
      (m) => m.user.email.toLowerCase() === fromEmail
    );
    const isOwner = boardEmail.board.owner.email.toLowerCase() === fromEmail;
    const isMember = senderMember || isOwner;

    if (boardEmail.requireMember && !isMember) {
      console.error(`Sender ${fromEmail} is not a board member`);
      return NextResponse.json({ error: "Sender not authorized" }, { status: 403 });
    }

    // Determine target column
    const columnId = boardEmail.columnId || boardEmail.board.columns[0]?.id;
    if (!columnId) {
      console.error("No column available for task");
      return NextResponse.json({ error: "No column available" }, { status: 400 });
    }

    // Get the next position in the column
    const lastTask = await prisma.task.findFirst({
      where: { columnId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (lastTask?.position ?? -1) + 1;

    // Determine assignee (if auto-assign is enabled and sender is a member)
    let assigneeId: string | null = null;
    if (boardEmail.autoAssign && isMember) {
      assigneeId = senderMember?.userId || (isOwner ? boardEmail.board.ownerId : null);
    }

    // Determine creator (use sender if member, otherwise board owner)
    const createdById = senderMember?.userId || (isOwner ? boardEmail.board.ownerId : boardEmail.board.ownerId);

    // Prepare description
    const description = emailData.html 
      ? sanitizeHtml(emailData.html)
      : (emailData.text || "");

    // Add email metadata to description
    const fullDescription = `📧 **From:** ${emailData.from}\n\n---\n\n${description}`.slice(0, 10000);

    // Create the task
    const task = await prisma.task.create({
      data: {
        columnId,
        title: emailData.subject.slice(0, 255) || "Email Task",
        description: fullDescription,
        position,
        priority: "medium",
        assigneeId,
        createdById,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        taskId: task.id,
        userId: createdById,
        action: "created",
        details: {
          via: "email",
          from: fromEmail,
          subject: emailData.subject,
        },
      },
    });

    console.log(`Task created via email: ${task.id} for board ${boardEmail.boardId}`);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      boardId: boardEmail.boardId,
    });
  } catch (error) {
    console.error("Email webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Health check / verification for email services
export async function GET(_request: NextRequest) {
  return NextResponse.json({ 
    status: "ok",
    service: "email-to-task",
    timestamp: new Date().toISOString(),
  });
}
