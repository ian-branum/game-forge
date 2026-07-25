import type { NarrativeScenario } from "@/lib/generators/narrative";

export const narrativeDemo: NarrativeScenario = {
  title: "The Last Transmission",
  genre: "Sci-Fi Thriller",
  opening: "The year is 2187. Your deep-space research station has gone dark, and you are the only crew member still conscious. An alien signal pulses from the lower decks.",
  scenes: [
    {
      id: 0,
      text: "Emergency lights bathe the corridor in red. The signal is coming from Lab 7. Your suit sensors show traces of an unknown biological agent in the air. Three options present themselves.",
      isEnd: false,
      choices: [
        { text: "Go to Lab 7 immediately", outcome: "You rush toward the signal, suit sealed tight.", nextScene: 1, isGood: true },
        { text: "Seal the bulkhead and call for help", outcome: "You lock down the section and open a distress channel.", nextScene: 2, isGood: false },
        { text: "Vent the lower decks to vacuum", outcome: "You reach for the emergency vent control.", nextScene: 3, isGood: false },
      ],
    },
    {
      id: 1,
      text: "Lab 7 is intact. A crystalline object on the bench pulses with blue light — clearly the signal source. It's warm to the touch even through your gloves. You have two choices.",
      isEnd: false,
      choices: [
        { text: "Secure the object and study it", outcome: "You carefully bag the crystal and head to the analysis suite.", nextScene: 4, isGood: true },
        { text: "Smash it", outcome: "You raise your boot. The crystal shatters — releasing a blinding flash.", nextScene: 5, isGood: false },
      ],
    },
    {
      id: 2,
      text: "The distress channel crackles. A voice responds — not human. It speaks your name. Your blood runs cold. The signal is getting stronger.",
      isEnd: false,
      choices: [
        { text: "Respond to the voice", outcome: "You open the channel and speak.", nextScene: 5, isGood: false },
        { text: "Trace the signal origin", outcome: "You pull up the station's sensor grid.", nextScene: 8, isGood: true },
      ],
    },
    {
      id: 3,
      text: "Your hand hovers over the vent control. A warning light blinks — a crew member's life-sign registers in Lab 7. Someone is still alive down there.",
      isEnd: false,
      choices: [
        { text: "Abort the vent — go find them", outcome: "You pull your hand back and sprint toward Lab 7.", nextScene: 1, isGood: true },
        { text: "Vent anyway", outcome: "You close your eyes and pull the lever.", nextScene: 6, isGood: false },
      ],
    },
    {
      id: 4,
      text: "Analysis complete. The crystal is a data storage device — containing star maps and a message of peace from a civilization 40 light-years away. You've made first contact.",
      isEnd: true,
      endType: "victory",
      choices: [],
    },
    {
      id: 5,
      text: "The flash blinds you. When your vision returns, the station is silent. Whatever was transmitting is gone — and so is any record of what you found. You'll never know.",
      isEnd: true,
      endType: "defeat",
      choices: [],
    },
    {
      id: 6,
      text: "The vent activates. The station groans. Later, the rescue team finds you alone — and a faint crystalline residue in Lab 7 that no one can explain. The signal is never heard again.",
      isEnd: true,
      endType: "neutral",
      choices: [],
    },
    {
      id: 7,
      text: "You find Dr. Reyes alive in Lab 7, clutching the crystal. She says it showed her visions — the senders are dying, and this was their final message. Together you document everything.",
      isEnd: true,
      endType: "victory",
      choices: [],
    },
    {
      id: 8,
      text: "The signal is coming from inside the hull — a secondary antenna array you didn't know existed. Someone installed it in secret. You trace the installation log to a crewmate.",
      isEnd: false,
      choices: [
        { text: "Confront the crewmate", outcome: "You head to their quarters, ready for answers.", nextScene: 7, isGood: true },
        { text: "Report it via distress beacon", outcome: "You transmit everything to mission control and wait.", nextScene: 6, isGood: false },
      ],
    },
  ],
};
