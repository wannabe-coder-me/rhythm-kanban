"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Pillar, TimeHorizon, PILLAR_CONFIG } from "@/types";

type Step = 
  | "welcome" 
  | "gratitude" 
  | "vision-health" 
  | "vision-wealth" 
  | "vision-relationships" 
  | "vision-career" 
  | "vision-spiritual" 
  | "vision-contribution"
  | "northstar"
  | "complete";

const VISION_STEPS: { step: Step; pillar: Pillar }[] = [
  { step: "vision-health", pillar: "HEALTH" },
  { step: "vision-wealth", pillar: "WEALTH" },
  { step: "vision-relationships", pillar: "RELATIONSHIPS" },
  { step: "vision-career", pillar: "CAREER" },
  { step: "vision-spiritual", pillar: "SPIRITUAL" },
  { step: "vision-contribution", pillar: "CONTRIBUTION" },
];

interface VisionInput {
  pillar: Pillar;
  title: string;
  horizon: TimeHorizon;
}

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);

  // Gratitude state
  const [gratitude, setGratitude] = useState(["", "", "", "", ""]);

  // Vision state - all visions collected during onboarding
  const [visions, setVisions] = useState<VisionInput[]>([]);
  const [currentVisionInputs, setCurrentVisionInputs] = useState(["", "", ""]);

  // North Star state
  const [selectedNorthStars, setSelectedNorthStars] = useState<Record<Pillar, string>>({
    HEALTH: "",
    WEALTH: "",
    RELATIONSHIPS: "",
    CAREER: "",
    SPIRITUAL: "",
    CONTRIBUTION: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Check if already onboarded
  useEffect(() => {
    if (session) {
      checkOnboardingStatus();
    }
  }, [session]);

  const checkOnboardingStatus = async () => {
    try {
      const res = await fetch("/api/life/settings");
      if (res.ok) {
        const settings = await res.json();
        if (settings?.onboardingCompleted) {
          router.push("/life");
        }
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
    }
  };

  const getCurrentPillar = (): Pillar | null => {
    const visionStep = VISION_STEPS.find(v => v.step === currentStep);
    return visionStep?.pillar || null;
  };

  const handleVisionNext = () => {
    const pillar = getCurrentPillar();
    if (!pillar) return;

    // Save non-empty visions
    const newVisions = currentVisionInputs
      .filter(v => v.trim())
      .map(title => ({
        pillar,
        title: title.trim(),
        horizon: "SOMEDAY" as TimeHorizon,
      }));

    setVisions([...visions, ...newVisions]);
    setCurrentVisionInputs(["", "", ""]);

    // Move to next step
    const currentIndex = VISION_STEPS.findIndex(v => v.step === currentStep);
    if (currentIndex < VISION_STEPS.length - 1) {
      setCurrentStep(VISION_STEPS[currentIndex + 1].step);
    } else {
      setCurrentStep("northstar");
    }
  };

  const getVisionsForPillar = (pillar: Pillar) => {
    return visions.filter(v => v.pillar === pillar);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // 1. Save all visions
      for (const vision of visions) {
        await fetch("/api/life/visions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vision),
        });
      }

      // 2. Create North Stars from selected visions
      for (const [pillar, title] of Object.entries(selectedNorthStars)) {
        if (title) {
          await fetch("/api/life/north-stars", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pillar,
              title,
              active: true,
            }),
          });
        }
      }

      // 3. Mark onboarding as complete
      await fetch("/api/life/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingCompleted: true,
          onboardingStep: 10,
        }),
      });

      setCurrentStep("complete");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    } finally {
      setSaving(false);
    }
  };

  const getStepNumber = () => {
    const steps: Step[] = ["welcome", "gratitude", ...VISION_STEPS.map(v => v.step), "northstar", "complete"];
    return steps.indexOf(currentStep);
  };

  const totalSteps = 10; // welcome, gratitude, 6 visions, northstar, complete

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a12] via-[#1a1a2e] to-[#0a0a12] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        {currentStep !== "welcome" && currentStep !== "complete" && (
          <div className="mb-8">
            <div className="flex justify-between text-sm text-white/40 mb-2">
              <span>Step {getStepNumber()} of {totalSteps - 2}</span>
              <span>{Math.round((getStepNumber() / (totalSteps - 2)) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                style={{ width: `${(getStepNumber() / (totalSteps - 2)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Welcome */}
        {currentStep === "welcome" && (
          <div className="text-center animate-fadeIn">
            <div className="text-8xl mb-6">🧭</div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Welcome to the Life System
            </h1>
            <p className="text-xl text-white/60 mb-8 italic">
              &ldquo;What the mind can conceive and believe, it can achieve.&rdquo;
            </p>
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 mb-8 text-left">
              <p className="text-white/80 mb-6">
                This is not another task manager. This is your life navigation system.
              </p>
              <p className="text-white/60 mb-4">In the next few minutes, you&apos;ll:</p>
              <ul className="space-y-3 text-white/60">
                <li className="flex items-center gap-3">
                  <span className="text-amber-400">🙏</span> Ground yourself in gratitude
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-violet-400">👁️</span> Define what you really want
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-cyan-400">⭐</span> Set your North Star for the year
                </li>
              </ul>
            </div>
            <button
              onClick={() => setCurrentStep("gratitude")}
              className="px-8 py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all text-lg"
            >
              Let&apos;s Begin →
            </button>
          </div>
        )}

        {/* Gratitude */}
        {currentStep === "gratitude" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🙏</div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Let&apos;s Start with Gratitude
              </h2>
              <p className="text-white/60">
                Before dreaming about the future, let&apos;s appreciate the present.
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
              <p className="text-white/80 mb-6">
                What are 5 things you&apos;re grateful for right now?
              </p>
              <div className="space-y-4">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-medium">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={gratitude[idx]}
                      onChange={(e) => {
                        const updated = [...gratitude];
                        updated[idx] = e.target.value;
                        setGratitude(updated);
                      }}
                      placeholder={`I'm grateful for...`}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep("vision-health")}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Vision Steps */}
        {VISION_STEPS.map(({ step, pillar }) => {
          if (currentStep !== step) return null;
          const config = PILLAR_CONFIG[pillar];
          
          return (
            <div key={step} className="animate-fadeIn">
              <div className="text-center mb-8">
                <div 
                  className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-4xl"
                  style={{ backgroundColor: config.color + "20" }}
                >
                  {config.emoji}
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {config.label}
                </h2>
                <p className="text-white/60">
                  What do you really want? No justification needed.
                </p>
              </div>

              <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
                <p className="text-white/80 mb-2">
                  Don&apos;t think about &ldquo;how&rdquo; — just &ldquo;what&rdquo;.
                </p>
                <p className="text-white/50 text-sm mb-6">
                  Dream big. You can add more later.
                </p>
                <div className="space-y-4">
                  {[0, 1, 2].map((idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={currentVisionInputs[idx]}
                      onChange={(e) => {
                        const updated = [...currentVisionInputs];
                        updated[idx] = e.target.value;
                        setCurrentVisionInputs(updated);
                      }}
                      placeholder={idx === 0 ? "e.g., " + getPlaceholder(pillar) : "Another vision..."}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-400/50"
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    const idx = VISION_STEPS.findIndex(v => v.step === step);
                    if (idx > 0) {
                      setCurrentStep(VISION_STEPS[idx - 1].step);
                    } else {
                      setCurrentStep("gratitude");
                    }
                  }}
                  className="px-6 py-4 bg-white/5 text-white/60 rounded-xl hover:bg-white/10"
                >
                  ← Back
                </button>
                <button
                  onClick={handleVisionNext}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all"
                >
                  Continue →
                </button>
              </div>
            </div>
          );
        })}

        {/* North Star Selection */}
        {currentStep === "northstar" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">⭐</div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Choose Your North Star
              </h2>
              <p className="text-white/60">
                Pick ONE goal per pillar for the next 12 months.
              </p>
              <p className="text-white/40 text-sm mt-2">
                This becomes your guiding light — review it daily.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => {
                const pillarVisions = getVisionsForPillar(pillar as Pillar);
                
                return (
                  <div 
                    key={pillar}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{config.emoji}</span>
                      <span className="text-white font-medium">{config.label}</span>
                    </div>
                    {pillarVisions.length > 0 ? (
                      <select
                        value={selectedNorthStars[pillar as Pillar]}
                        onChange={(e) => setSelectedNorthStars({
                          ...selectedNorthStars,
                          [pillar]: e.target.value,
                        })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-400/50"
                      >
                        <option value="">Select your North Star...</option>
                        {pillarVisions.map((v, idx) => (
                          <option key={idx} value={v.title}>{v.title}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedNorthStars[pillar as Pillar]}
                        onChange={(e) => setSelectedNorthStars({
                          ...selectedNorthStars,
                          [pillar]: e.target.value,
                        })}
                        placeholder={`Your ${config.label.toLowerCase()} goal for the year...`}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-400/50"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep("vision-contribution")}
                className="px-6 py-4 bg-white/5 text-white/60 rounded-xl hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Complete Setup ✓"}
              </button>
            </div>
          </div>
        )}

        {/* Complete */}
        {currentStep === "complete" && (
          <div className="text-center animate-fadeIn">
            <div className="text-8xl mb-6 animate-bounce">🎉</div>
            <h1 className="text-4xl font-bold text-white mb-4">
              You&apos;re Ready to Navigate!
            </h1>
            <p className="text-xl text-white/60 mb-8">
              Your North Star is set. Your vision is captured.
            </p>

            <div className="bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-2xl p-8 border border-violet-400/20 mb-8">
              <p className="text-white/80 mb-4">Remember:</p>
              <ul className="space-y-3 text-white/60 text-left max-w-md mx-auto">
                <li className="flex items-center gap-3">
                  <span>☀️</span> Review your North Star every morning
                </li>
                <li className="flex items-center gap-3">
                  <span>🌙</span> Reflect on it every evening
                </li>
                <li className="flex items-center gap-3">
                  <span>🎯</span> Take action every day
                </li>
              </ul>
            </div>

            <p className="text-2xl text-violet-400 italic mb-8">
              &ldquo;Dream. Believe. Achieve.&rdquo;
            </p>

            <button
              onClick={() => router.push("/life")}
              className="px-8 py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all text-lg"
            >
              Go to Dashboard →
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

function getPlaceholder(pillar: Pillar): string {
  const placeholders: Record<Pillar, string> = {
    HEALTH: "Run a marathon, 34-inch waist",
    WEALTH: "$500K savings, own a home",
    RELATIONSHIPS: "Weekly date nights, closer family bonds",
    CAREER: "Launch my SaaS, get promoted",
    SPIRITUAL: "Meditate daily, deeper faith",
    CONTRIBUTION: "Mentor 5 founders, volunteer monthly",
  };
  return placeholders[pillar];
}
