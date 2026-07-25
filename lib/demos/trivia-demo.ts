import type { TriviaScenario } from "@/lib/generators/trivia";

export const triviaDemo: TriviaScenario = {
  title: "Space Exploration Quiz",
  topic: "The history and science of human spaceflight",
  questions: [
    {
      q: "What year did humans first land on the Moon?",
      options: ["1965", "1967", "1969", "1971"],
      answer: 2,
      explanation: "Apollo 11 landed on July 20, 1969. Neil Armstrong was first to step out.",
    },
    {
      q: "Which space agency launched the first artificial satellite, Sputnik 1?",
      options: ["NASA", "ESA", "JAXA", "Soviet Union"],
      answer: 3,
      explanation: "The USSR launched Sputnik 1 on October 4, 1957, starting the Space Age.",
    },
    {
      q: "What is the name of NASA's Mars rover that landed in Jezero Crater in 2021?",
      options: ["Curiosity", "Perseverance", "Opportunity", "Spirit"],
      answer: 1,
      explanation: "Perseverance landed on February 18, 2021, and carries the Ingenuity helicopter.",
    },
    {
      q: "How long does light from the Sun take to reach Earth?",
      options: ["About 8 seconds", "About 8 minutes", "About 8 hours", "About 8 days"],
      answer: 1,
      explanation: "Light travels at ~300,000 km/s and takes ~8.3 minutes to cross the ~150 million km to Earth.",
    },
    {
      q: "What is the International Space Station's orbital altitude (approx)?",
      options: ["100 km", "250 km", "400 km", "800 km"],
      answer: 2,
      explanation: "The ISS orbits at approximately 400 km, completing a lap of Earth every ~92 minutes.",
    },
    {
      q: "Which planet has the most moons in our solar system?",
      options: ["Jupiter", "Saturn", "Uranus", "Neptune"],
      answer: 1,
      explanation: "As of 2024, Saturn leads with 146 confirmed moons, overtaking Jupiter.",
    },
    {
      q: "What fuel did the Saturn V rocket use for its first stage engines?",
      options: ["Liquid hydrogen", "RP-1 kerosene", "Methane", "Hydrazine"],
      answer: 1,
      explanation: "The F-1 engines burned RP-1 (a refined kerosene) with liquid oxygen as oxidizer.",
    },
    {
      q: "The Voyager 1 probe, launched in 1977, is notable for being the first human-made object to do what?",
      options: ["Orbit Mars", "Land on an asteroid", "Enter interstellar space", "Fly past Pluto"],
      answer: 2,
      explanation: "Voyager 1 crossed into interstellar space in 2012, confirmed by NASA in 2013.",
    },
  ],
};
