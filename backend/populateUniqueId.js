const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((err) => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
    googleId: String,
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: String,
    walletBalance: {
      type: Number,
      default: 200,
    },
    inventory: [
      {
        uniqueId: {
          type: String,
          default: () => uuidv4(),
        },
        _id: mongoose.Schema.Types.ObjectId,
        name: String,
        image: String,
        rarity: String,
        case: mongoose.Schema.Types.ObjectId,
      },
    ],
    fixedItem: {
      name: String,
      image: String,
      rarity: String,
      description: String,
    },
    xp: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 0,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    nextBonus: {
      type: Date,
      default: () => Date.now() - 86400000,
    },
    bonusAmount: {
      type: Number,
      default: 1000,
    },
    weeklyWinnings: {
      type: Number,
      default: 0,
    },
    lastWinningsUpdate: {
      type: Date,
      default: Date.now,
    },
  });
  

const User = mongoose.model("User", UserSchema);

async function updateUniqueIdForInventoryItems() {
  const batchSize = 100;  // Adjust this number based on performance
  let batchCount = 0;

  try {
    const users = await User.find({});
    console.log(`Total users to process: ${users.length}`);

    for (const user of users) {
      let updated = false;
      for (const item of user.inventory) {
        if (!item.uniqueId) {
          item.uniqueId = uuidv4();
          updated = true;
        }
      }
      if (updated) {
        await user.save();
        batchCount++;
        if (batchCount % batchSize === 0) {
          console.log(`Processed ${batchCount} users...`);
        }
      }
    }

    console.log(`Finished processing ${users.length} users.`);
    mongoose.connection.close();
  } catch (error) {
    console.error('Error updating uniqueId for inventory items:', error);
    mongoose.connection.close();
  }
}

updateUniqueIdForInventoryItems();
