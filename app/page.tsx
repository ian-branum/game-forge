export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <h1 className="font-orbitron text-5xl font-black tracking-widest text-white mb-4">
        GAME FORGE
      </h1>
      <p className="text-gray-400 text-lg max-w-xl">
        Describe a battle. Play it.
      </p>
      <a
        href="/play"
        className="mt-10 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded font-orbitron text-sm tracking-widest transition"
      >
        PLAY NORMANDY (DEMO)
      </a>
    </main>
  );
}
