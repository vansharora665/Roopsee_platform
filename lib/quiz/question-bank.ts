export type QuizQuestion = {
  id: string;
  prompt: string;
  options?: string[];
};

export const quizQuestionBank: QuizQuestion[] = [
  {
    id: "1",
    prompt: "What are your main skin concerns?",
    options: ["Acne", "Dark spots", "Pigmentation", "Melasma", "Dryness", "Dullness", "Wrinkles or Anti-aging"]
  },
  {
    id: "2",
    prompt: "How often do you experience breakouts or acne?"
  },
  {
    id: "3",
    prompt: "How does your skin feel after washing your face?",
    options: ["Normal", "Oily", "Dry or Tight", "Combination (oily T-zone, dry cheeks)"]
  },
  {
    id: "4",
    prompt: "How often does your skin feel sensitive, irritated, or reactive?"
  },
  {
    id: "5",
    prompt: "Do you have any known allergy?",
    options: [
      "Any product or ingredient allergy",
      "Any irritation caused by any product earlier",
      "No"
    ]
  },
  {
    id: "6",
    prompt: "How are your eating habits?"
  },
  {
    id: "7",
    prompt: "How much water do you drink daily?"
  },
  {
    id: "8",
    prompt: "How often do you exercise?"
  },
  {
    id: "9",
    prompt: "Do you experience high stress levels?"
  },
  {
    id: "10",
    prompt: "How many hours do you sleep?"
  },
  {
    id: "11",
    prompt: "Do you have any hormonal issues?"
  },
  {
    id: "12",
    prompt: "Are your periods regular?"
  },
  {
    id: "13",
    prompt: "Are you?"
  },
  {
    id: "14",
    prompt: "Any history of"
  },
  {
    id: "15",
    prompt: "Any other medical history or medications?"
  },
  {
    id: "16",
    prompt: "How is your environment where you stay or work?"
  },
  {
    id: "17",
    prompt: "What products are you using currently?"
  },
  {
    id: "18",
    prompt: "How consistent is your current skincare routine?"
  },
  {
    id: "19",
    prompt: "What are your expectations?"
  }
];

export const quizQuestionLookup = Object.fromEntries(
  quizQuestionBank.map((question) => [question.id, question])
);
