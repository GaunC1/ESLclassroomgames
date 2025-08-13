const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function upsertGame(name, description, rounds) {
  const game = await prisma.game.upsert({
    where: { name },
    update: {},
    create: { name, description },
  });

  // Clear existing rounds and recreate to keep indexes tidy
  await prisma.round.deleteMany({ where: { gameId: game.id } });
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    await prisma.round.create({
      data: {
        gameId: game.id,
        index: i,
        title: r.title || `Round ${i + 1}`,
        targets: JSON.stringify(r.targets),
      },
    });
  }
}

async function main() {
  const DEFAULT_ROUNDS = [
    { title: 'Round 1 – 6 words', targets: ['ball', 'pencil', 'red', 'blue', 'in', 'on'] },
    { title: 'Round 2 – 7 words', targets: ['book', 'chair', 'green', 'yellow', 'under', 'next to', 'small'] },
    { title: 'Round 3 – 8 words', targets: ['dog', 'box', 'pink', 'black', 'between', 'in front of', 'big', 'cup'] },
    { title: 'Round 4 – 9 words', targets: ['shoe', 'bag', 'white', 'brown', 'near', 'across from', 'happy', 'sad', 'table'] },
    { title: 'Round 5 – 10 words', targets: ['cat', 'door', 'run', 'jump', 'over', 'beside', 'purple', 'orange', 'lamp', 'hat'] },
    { title: 'Round 6 – 10 words (more complex mix)', targets: ['car', 'tree', 'gold', 'silver', 'around', 'underneath', 'fast', 'slow', 'boy', 'girl'] },
    { title: 'Round 7 – 10 words (trickier nouns & adjectives)', targets: ['dragon', 'window', 'soft', 'hard', 'between', 'next to', 'tall', 'short', 'door', 'chair'] },
    { title: 'Round 8 – 10 words (verbs + time phrases)', targets: ['elephant', 'box', 'sing', 'dance', 'on top of', 'behind', 'morning', 'night', 'green', 'red'] },
    { title: 'Round 9 – 10 words (abstract + concrete)', targets: ['teacher', 'desk', 'smart', 'funny', 'in front of', 'near', 'book', 'pencil', 'blue', 'yellow'] },
    { title: 'Round 10 – 10 words (ultimate challenge)', targets: ['spaceship', 'mountain', 'giant', 'tiny', 'across from', 'beside', 'black', 'white', 'happy', 'sad'] },
  ];

  const ANIMALS_ACTIONS = [
    { title: 'Round 1', targets: ['cat', 'dog', 'run', 'jump', 'on', 'under'] },
    { title: 'Round 2', targets: ['bird', 'fish', 'fly', 'swim', 'behind', 'in front of'] },
    { title: 'Round 3', targets: ['lion', 'monkey', 'roar', 'climb', 'between', 'near'] },
  ];

  await upsertGame('Prepositions & Colors', 'Default ESL word bank', DEFAULT_ROUNDS);
  await upsertGame('Animals & Actions', 'Animal words and action verbs', ANIMALS_ACTIONS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
