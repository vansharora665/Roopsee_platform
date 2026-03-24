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
    prompt: "Do you experience frequent breakouts or acne?",
    options: ["Yes", "No"]
  },
  {
    id: "3",
    prompt: "How does your skin feel after washing your face?",
    options: ["Normal", "Oily", "Dry or Tight", "Combination"]
  },
  {
    id: "4",
    prompt: "Do you have sensitive skin?",
    options: ["Yes", "No"]
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
    prompt: "How are your eating habits?",
    options: [
      "Consume high sugar or dairy products frequently",
      "Often have fried or processed foods",
      "Eat fruits and vegetables daily",
      "Have a healthy diet"
    ]
  },
  {
    id: "7",
    prompt: "How much water do you drink daily?",
    options: ["Less than 1 litre", "1-2 litres", "2-3 litres", "More than 3 litres"]
  },
  {
    id: "8",
    prompt: "Do you exercise daily?",
    options: ["Yes", "No", "Sometimes"]
  },
  {
    id: "9",
    prompt: "Do you experience high stress levels?",
    options: ["Yes", "No"]
  },
  {
    id: "10",
    prompt: "How many hours do you sleep?",
    options: ["< 6 Hours", "6-8 Hours", "8-10 Hours", "> 10 Hours"]
  },
  {
    id: "11",
    prompt: "Do you have any hormonal issues?",
    options: ["PCOD/PCOS", "Thyroid", "No"]
  },
  {
    id: "12",
    prompt: "Are your periods regular?",
    options: ["Yes", "No", "Sometimes irregular"]
  },
  {
    id: "13",
    prompt: "Are you?",
    options: ["Pregnant", "Breastfeeding", "Planning for pregnancy", "None of the Above"]
  },
  {
    id: "14",
    prompt: "Any history of",
    options: ["Herpes", "Eczema", "Psoriasis", "Any other skin infection", "No"]
  },
  {
    id: "15",
    prompt: "Any other medical history or medications?"
  },
  {
    id: "16",
    prompt: "How is your environment where you stay or work?",
    options: [
      "Pollution and climate affect skin",
      "Spend lots of time in sunlight",
      "Most of the day in AC",
      "Mostly on screens",
      "Have a healthy environment"
    ]
  },
  {
    id: "17",
    prompt: "What products are you using currently?"
  },
  {
    id: "18",
    prompt: "What are your expectations?"
  }
];

export const quizQuestionLookup = Object.fromEntries(
  quizQuestionBank.map((question) => [question.id, question])
);
