"use client";

import { useState, type ReactNode } from "react";

export function ProjectTabs({
  foundational,
  assets,
  answers,
  answersCount,
}: {
  foundational: ReactNode;
  assets: ReactNode;
  answers: ReactNode;
  answersCount: number;
}) {
  const [active, setActive] = useState<"foundational" | "assets" | "answers">(
    "foundational"
  );

  return (
    <div>
      <div className="tab-bar">
        <button
          className={`tab-item${active === "foundational" ? " active" : ""}`}
          onClick={() => setActive("foundational")}
        >
          Foundational Documents
        </button>
        <button
          className={`tab-item${active === "assets" ? " active" : ""}`}
          onClick={() => setActive("assets")}
        >
          Assets
        </button>
        <button
          className={`tab-item${active === "answers" ? " active" : ""}`}
          onClick={() => setActive("answers")}
        >
          Onboarding Answers
          {answersCount > 0 && <span className="tab-count">{answersCount}</span>}
        </button>
      </div>

      {active === "foundational" && foundational}
      {active === "assets" && assets}
      {active === "answers" && answers}
    </div>
  );
}
