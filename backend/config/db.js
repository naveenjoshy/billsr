import mongoose from 'mongoose';

/**
 * Establishes a connection to the MongoDB cluster using the
 * provided URI and specifies the explicit database configuration target.
 */
const connectDB = async () => {
  try {
    const connectionUri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB;

    // Fallback sanity validation check
    if (!connectionUri || !dbName) {
      throw new Error("Missing MONGODB_URI configuration parameter inside environmental configurations.");
    }

    const options = {
      dbName: dbName || undefined, // Overrides default path cluster endpoints if a custom name is explicitly declared
    };

    const conn = await mongoose.connect(connectionUri, options);
    
    console.log(`MongoDB Connected Successfully`);
    if (dbName) {
      console.log(`Active Database Context: ${conn.connection.name}`);
    }
  } catch (error) {
    console.error(`Database Connection Error Failure: ${error.message}`);
    process.exit(1); // Forcefully kill system loop execution processes on error context
  }
};

export default connectDB;
