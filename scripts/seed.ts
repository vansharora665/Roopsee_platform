import { Prisma } from "@prisma/client";

import { prisma } from "../lib/db/prisma";
import { promptJsonShape } from "../lib/report/manual-prompt-builder";

function clonePromptDraft() {
  return JSON.parse(JSON.stringify(promptJsonShape));
}

async function main() {
  await prisma.report.deleteMany();
  await prisma.syncedProfile.deleteMany();
  await prisma.productCatalog.deleteMany();

  const doctor = await prisma.user.upsert({
    where: {
      email: "doctor@roopsee.local"
    },
    update: {
      name: "Dr. Monika",
      role: "doctor"
    },
    create: {
      name: "Dr. Monika",
      email: "doctor@roopsee.local",
      role: "doctor"
    }
  });

  await prisma.user.upsert({
    where: {
      email: "admin@roopsee.local"
    },
    update: {
      name: "Roopsee Admin",
      role: "admin"
    },
    create: {
      name: "Roopsee Admin",
      email: "admin@roopsee.local",
      role: "admin"
    }
  });

  const cleanser = await prisma.productCatalog.create({
    data: {
      brandName: "Cetaphil",
      productName: "Gentle Skin Cleanser",
      category: "Cleanser",
      productType: "Face Cleanser",
      claimedSkinTypes: ["Dry", "Sensitive", "Combination"],
      claimedSkinConcerns: ["Dryness", "Sensitivity", "Barrier support"],
      heroIngredients: ["Glycerin"],
      otherKeyIngredients: ["Panthenol"],
      potentialIrritants: [],
      textureFinish: "Lotion",
      overallSuitabilityScore: 5,
      productUrl: "https://example.com/cetaphil-cleanser"
    }
  });

  const sunscreen = await prisma.productCatalog.create({
    data: {
      brandName: "La Shield",
      productName: "SPF 50 Gel",
      category: "Sunscreen",
      productType: "Sunscreen",
      claimedSkinTypes: ["Combination", "Oily", "Sensitive"],
      claimedSkinConcerns: ["Pigmentation", "Sun protection"],
      heroIngredients: ["Broad-spectrum UV filters"],
      otherKeyIngredients: ["Vitamin E"],
      potentialIrritants: [],
      textureFinish: "Gel",
      overallSuitabilityScore: 5,
      productUrl: "https://example.com/la-shield-spf-50"
    }
  });

  const moisturizer = await prisma.productCatalog.create({
    data: {
      brandName: "CeraVe",
      productName: "Moisturizing Lotion",
      category: "Moisturizer",
      productType: "Moisturizer",
      claimedSkinTypes: ["Dry", "Combination", "Sensitive"],
      claimedSkinConcerns: ["Dryness", "Barrier support"],
      heroIngredients: ["Ceramides"],
      otherKeyIngredients: ["Hyaluronic Acid"],
      potentialIrritants: [],
      textureFinish: "Lotion",
      overallSuitabilityScore: 5,
      productUrl: "https://example.com/cerave-lotion"
    }
  });

  const repairSerum = await prisma.productCatalog.create({
    data: {
      brandName: "Minimalist",
      productName: "Niacinamide 5% Serum",
      category: "Serum",
      productType: "Treatment Serum",
      claimedSkinTypes: ["Combination", "Oily", "Sensitive"],
      claimedSkinConcerns: ["Pigmentation", "Uneven tone", "Oil control"],
      heroIngredients: ["Niacinamide"],
      otherKeyIngredients: ["Panthenol", "Zinc"],
      potentialIrritants: [],
      textureFinish: "Serum",
      overallSuitabilityScore: 5,
      productUrl: "https://example.com/minimalist-niacinamide"
    }
  });

  const syncedProfile = await prisma.syncedProfile.create({
    data: {
      externalId: "supabase-profile-aashi",
      sourceTable: "profiles",
      fullName: "Aashi",
      email: "aashi@example.com",
      age: 25,
      sex: "Female",
      profileJson: {
        name: "Aashi",
        age: 25,
        sex: "Female"
      },
      quizJson: {
        main_concern: ["Pigmentation", "Dullness"],
        sensitivity: ["Yes"],
        current_products: ["Cleanser", "Moisturizer"]
      },
      quizSummaryJson: [
        "What are your main skin concerns?: Pigmentation, Dullness",
        "Do you have sensitive skin?: Yes",
        "What products are you currently using?: Cleanser, Moisturizer"
      ],
      scansJson: {
        front: "https://placehold.co/600x600?text=Front+Scan",
        left: "https://placehold.co/600x600?text=Left+Scan",
        right: "https://placehold.co/600x600?text=Right+Scan"
      },
      scanUrls: [
        "https://placehold.co/600x600?text=Front+Scan",
        "https://placehold.co/600x600?text=Left+Scan",
        "https://placehold.co/600x600?text=Right+Scan"
      ],
      profileSummary: "Main concern: pigmentation and dullness. Sensitive skin reported. Currently uses cleanser and moisturizer.",
      lastSyncedAt: new Date()
    }
  });

  const approvedDraft = clonePromptDraft();
  approvedDraft.analysis.skin_score.score = 7.4;
  approvedDraft.analysis.skin_score.label = "Good (Minor concerns)";
  approvedDraft.analysis.overall_skin_profile.skin_type = "Combination";
  approvedDraft.analysis.overall_skin_profile.condition = "Mild pigmentation with dehydration tendency";
  approvedDraft.analysis.key_skin_concerns.primary = ["Pigmentation", "Uneven tone"];
  approvedDraft.analysis.key_skin_concerns.secondary = ["Dullness"];
  approvedDraft.product_matching.target_concerns = ["Pigmentation", "Uneven tone"];
  approvedDraft.product_matching.preferred_textures = ["Gel", "Lotion"];

  await prisma.report.create({
    data: {
      status: "approved",
      intakeSource: "supabase",
      promptInputMode: "scan_assisted",
      approvedAt: new Date("2026-03-20T10:15:00.000Z"),
      approvedByUserId: doctor.id,
      syncedProfileId: syncedProfile.id,
      patientInfo: {
        create: {
          name: "Aashi",
          age: 25,
          sex: "Female",
          reportDate: new Date("2026-03-17"),
          inputSources: ["3 facial images", "Questionnaire", "Skin quiz"]
        }
      },
      assets: {
        create: {
          image1Url: "https://placehold.co/600x600?text=Front+Scan",
          image2Url: "https://placehold.co/600x600?text=Left+Scan",
          image3Url: "https://placehold.co/600x600?text=Right+Scan",
          questionnaireText: syncedProfile.profileSummary,
          rawFindingsText: "Combination oil distribution with visible pigmentation and mild dehydration.",
          visibleIssues: ["Pigmentation", "Dullness", "Mild texture irregularity"],
          negativeFindings: ["No active inflammatory acne", "No severe barrier damage"],
          profileHints: ["Combination skin", "Needs hydration support"],
          quizSummaryJson: syncedProfile.quizSummaryJson as Prisma.InputJsonValue,
          scanContextJson: syncedProfile.scansJson as Prisma.InputJsonValue
        }
      },
      analysisOutput: {
        create: {
          skinScore: approvedDraft.analysis.skin_score.score,
          skinScoreLabel: approvedDraft.analysis.skin_score.label,
          skinType: approvedDraft.analysis.overall_skin_profile.skin_type,
          condition: approvedDraft.analysis.overall_skin_profile.condition,
          overallSeverity: approvedDraft.analysis.overall_skin_profile.overall_severity,
          primaryConcerns: approvedDraft.analysis.key_skin_concerns.primary,
          secondaryConcerns: approvedDraft.analysis.key_skin_concerns.secondary,
          positiveFindings: approvedDraft.analysis.positive_findings,
          oilLevels: approvedDraft.analysis.primary_observations.oil_levels,
          hydration: approvedDraft.analysis.primary_observations.hydration,
          texture: approvedDraft.analysis.primary_observations.texture,
          tone: approvedDraft.analysis.primary_observations.tone,
          ingredientPlan: approvedDraft.ingredient_plan,
          routinePlan: approvedDraft.routine_plan,
          productMatchingNotes: approvedDraft.product_matching,
          doctorHandoffJson: approvedDraft.doctor_handoff,
          rawModelJson: approvedDraft.analysis
        }
      },
      promptSession: {
        create: {
          status: "completed",
          promptText: "Sample prompt saved from manual ChatGPT workflow.",
          promptContext: {
            provider: "manual-import",
            intakeSource: "supabase",
            promptInputMode: "scan_assisted"
          },
          responseRawText: JSON.stringify(approvedDraft, null, 2),
          responseJson: approvedDraft
        }
      },
      doctorReview: {
        create: {
          cleanserBrand: cleanser.brandName,
          cleanserCompany: cleanser.brandName,
          cleanserProductName: cleanser.productName,
          sunscreenBrand: sunscreen.brandName,
          sunscreenCompany: sunscreen.brandName,
          sunscreenProductName: sunscreen.productName,
          moisturizerBrand: moisturizer.brandName,
          moisturizerCompany: moisturizer.brandName,
          moisturizerProductName: moisturizer.productName,
          repairSerumBrand: repairSerum.brandName,
          repairSerumCompany: repairSerum.brandName,
          repairSerumProductName: repairSerum.productName,
          morningRoutine: [
            { step: "Cleanser", usageAmount: "1 pump" },
            { step: "Moisturizer", usageAmount: "1 fingertip unit" },
            { step: "Sunscreen", usageAmount: "2 finger lengths" }
          ],
          nightRoutine: [
            { step: "Cleanser", usageAmount: "1 pump" },
            { step: "Repair serum", usageAmount: "2-3 drops" },
            { step: "Moisturizer", usageAmount: "1 fingertip unit" }
          ],
          doThis: ["Use sunscreen daily", "Prioritize barrier hydration"],
          notThat: ["Avoid harsh scrubs", "Do not skip moisturizer"],
          expertTips: [
            "Reassess pigmentation every 6 weeks.",
            "Introduce active treatments gradually if irritation appears."
          ],
          doctorNotes: "Suitable for a conservative pigmentation-focused regimen.",
          reviewedByUserId: doctor.id
        }
      },
      generatedFile: {
        create: {
          pdfUrl: null,
          htmlSnapshotPath: null
        }
      },
      productMatches: {
        create: [
          {
            slot: "cleanser",
            rank: 1,
            matchScore: 92,
            reasonJson: { matchedHeroIngredients: ["Glycerin"] },
            product: { connect: { id: cleanser.id } }
          },
          {
            slot: "sunscreen",
            rank: 1,
            matchScore: 95,
            reasonJson: { matchedHeroIngredients: ["Broad-spectrum UV filters"] },
            product: { connect: { id: sunscreen.id } }
          },
          {
            slot: "moisturizer",
            rank: 1,
            matchScore: 91,
            reasonJson: { matchedHeroIngredients: ["Ceramides"] },
            product: { connect: { id: moisturizer.id } }
          },
          {
            slot: "repair_serum",
            rank: 1,
            matchScore: 90,
            reasonJson: { matchedHeroIngredients: ["Niacinamide"] },
            product: { connect: { id: repairSerum.id } }
          }
        ]
      }
    }
  });

  const draftOnly = clonePromptDraft();
  draftOnly.analysis.skin_score.score = 5.6;
  draftOnly.analysis.skin_score.label = "Moderate (Needs improvement)";
  draftOnly.analysis.overall_skin_profile.skin_type = "Combination to oily";
  draftOnly.analysis.overall_skin_profile.condition = "Congestion-prone skin with mild dehydration";
  draftOnly.analysis.overall_skin_profile.overall_severity = "Moderate";
  draftOnly.analysis.key_skin_concerns.primary = ["Clogged pores", "Oil imbalance"];
  draftOnly.analysis.key_skin_concerns.secondary = ["Uneven texture"];
  draftOnly.analysis.positive_findings = ["No cystic acne", "No severe erythema"];
  draftOnly.analysis.primary_observations.oil_levels = "High";
  draftOnly.product_matching.target_concerns = ["Clogged pores", "Oil imbalance"];
  draftOnly.product_matching.preferred_textures = ["Gel", "Fluid"];

  await prisma.report.create({
    data: {
      status: "draft_generated",
      intakeSource: "manual",
      promptInputMode: "manual_context",
      patientInfo: {
        create: {
          name: "Riya Sharma",
          age: 31,
          sex: "Female",
          reportDate: new Date("2026-03-21"),
          inputSources: ["Manual findings", "Questionnaire"]
        }
      },
      assets: {
        create: {
          questionnaireText: "Concerned about oiliness, occasional clogged pores, and uneven texture.",
          rawFindingsText: "T-zone shine with visible congestion near the nose and chin. No cystic lesions seen.",
          visibleIssues: ["Clogged pores", "Oiliness", "Uneven texture"],
          negativeFindings: ["No cystic acne", "No severe erythema"],
          profileHints: ["Combination to oily skin"]
        }
      },
      analysisOutput: {
        create: {
          skinScore: draftOnly.analysis.skin_score.score,
          skinScoreLabel: draftOnly.analysis.skin_score.label,
          skinType: draftOnly.analysis.overall_skin_profile.skin_type,
          condition: draftOnly.analysis.overall_skin_profile.condition,
          overallSeverity: draftOnly.analysis.overall_skin_profile.overall_severity,
          primaryConcerns: draftOnly.analysis.key_skin_concerns.primary,
          secondaryConcerns: draftOnly.analysis.key_skin_concerns.secondary,
          positiveFindings: draftOnly.analysis.positive_findings,
          oilLevels: draftOnly.analysis.primary_observations.oil_levels,
          hydration: draftOnly.analysis.primary_observations.hydration,
          texture: draftOnly.analysis.primary_observations.texture,
          tone: draftOnly.analysis.primary_observations.tone,
          ingredientPlan: draftOnly.ingredient_plan,
          routinePlan: draftOnly.routine_plan,
          productMatchingNotes: draftOnly.product_matching,
          doctorHandoffJson: draftOnly.doctor_handoff,
          rawModelJson: draftOnly.analysis
        }
      },
      promptSession: {
        create: {
          status: "completed",
          promptText: "Sample manual-context prompt saved from the platform.",
          promptContext: {
            provider: "manual-import",
            intakeSource: "manual",
            promptInputMode: "manual_context"
          },
          responseRawText: JSON.stringify(draftOnly, null, 2),
          responseJson: draftOnly
        }
      },
      doctorReview: {
        create: {
          cleanserBrand: cleanser.brandName,
          cleanserCompany: cleanser.brandName,
          cleanserProductName: cleanser.productName,
          sunscreenBrand: sunscreen.brandName,
          sunscreenCompany: sunscreen.brandName,
          sunscreenProductName: sunscreen.productName,
          moisturizerBrand: moisturizer.brandName,
          moisturizerCompany: moisturizer.brandName,
          moisturizerProductName: moisturizer.productName,
          repairSerumBrand: repairSerum.brandName,
          repairSerumCompany: repairSerum.brandName,
          repairSerumProductName: repairSerum.productName,
          morningRoutine: [
            { step: "Cleanser", usageAmount: "1 pump" },
            { step: "Sunscreen", usageAmount: "2 finger lengths" }
          ],
          nightRoutine: [
            { step: "Cleanser", usageAmount: "1 pump" },
            { step: "Repair serum", usageAmount: "2-3 drops" }
          ],
          doThis: [],
          notThat: [],
          expertTips: []
        }
      },
      generatedFile: {
        create: {
          pdfUrl: null,
          htmlSnapshotPath: null
        }
      },
      productMatches: {
        create: [
          {
            slot: "cleanser",
            rank: 1,
            matchScore: 89,
            reasonJson: { matchedHeroIngredients: ["Glycerin"] },
            product: { connect: { id: cleanser.id } }
          },
          {
            slot: "sunscreen",
            rank: 1,
            matchScore: 94,
            reasonJson: { matchedHeroIngredients: ["Broad-spectrum UV filters"] },
            product: { connect: { id: sunscreen.id } }
          },
          {
            slot: "moisturizer",
            rank: 1,
            matchScore: 88,
            reasonJson: { matchedHeroIngredients: ["Ceramides"] },
            product: { connect: { id: moisturizer.id } }
          },
          {
            slot: "repair_serum",
            rank: 1,
            matchScore: 93,
            reasonJson: { matchedHeroIngredients: ["Niacinamide"] },
            product: { connect: { id: repairSerum.id } }
          }
        ]
      }
    }
  });

  console.log("Seed complete. Demo users, product catalog, synced profile, and reports created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
