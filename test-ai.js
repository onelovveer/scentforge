const { generateProductDescription } = require('./ai-service');
async function test() {
  try {
    const desc = await generateProductDescription('Sauvage', 'Dior');
    console.log('Result:', desc);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
