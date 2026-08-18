require('dotenv').config();

const mongoose = require('mongoose');
const Station = require('./models/Station');
const defaultStations = require('./data/defaultStations');

async function seedStations() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const uniqueStations = Array.from(
    new Map(defaultStations.map((station) => [`${station.name}|${station.line}`, station])).values()
  );

  const operations = uniqueStations.map((station) => ({
    updateOne: {
      filter: { name: station.name, line: station.line },
      update: { $set: station },
      upsert: true
    }
  }));

  const result = await Station.bulkWrite(operations, { ordered: false });
  const inserted = result.upsertedCount || 0;
  const modified = result.modifiedCount || 0;
  console.log(`Station seed completed: ${inserted} added, ${modified} synchronized, ${uniqueStations.length} total.`);
}

seedStations()
  .catch((error) => {
    console.error(`Station seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
