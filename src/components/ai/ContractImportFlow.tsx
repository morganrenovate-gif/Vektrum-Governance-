'use client'

import { useState } from "react";
import { ContractUploadModal } from "./ContractUploadModal";
import { MilestoneReviewScreen } from "./MilestoneReviewScreen";
import type { ContractAnalysisResult, DealMetadata } from "./ContractUploadModal";

type Props = {
  metadata: DealMetadata;
  onClose: () => void;
};

type FlowStep = "upload" | "review";

export function ContractImportFlow({ metadata, onClose }: Props) {
  const [step, setStep] = useState<FlowStep>("upload");
  const [analysis, setAnalysis] = useState<ContractAnalysisResult | null>(null);

  if (step === "review" && analysis) {
    return (
      <MilestoneReviewScreen
        metadata={metadata}
        analysis={analysis}
        onBack={() => setStep("upload")}
        onClose={onClose}
      />
    );
  }

  return (
    <ContractUploadModal
      metadata={metadata}
      onSuccess={(result) => {
        setAnalysis(result);
        setStep("review");
      }}
      onClose={onClose}
    />
  );
}
