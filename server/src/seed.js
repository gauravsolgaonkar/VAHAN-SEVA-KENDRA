// `npm run seed`: (re)create the demo tenant.
import mongoose from 'mongoose';
import { config } from './config.js';
import { seedDemo } from './seedDemo.js';

await mongoose.connect(config.mongoUri);
await seedDemo();
await mongoose.disconnect();
