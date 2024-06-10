const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

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
  
const User = mongoose.model('User', UserSchema);

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  senderId: mongoose.Schema.Types.ObjectId,
  receiverId: mongoose.Schema.Types.ObjectId,
  type: {
    type: String,
    enum: ['friendRequest', 'message', 'alert'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Notification = mongoose.model('Notification', NotificationSchema);

async function sendNotificationToAll(title, content) {
  try {
    const users = await User.find({
      username: "koishshrimp"
    });
    const notifications = users.map(user => ({
      receiverId: user._id,
      type: 'message',
      title,
      content,
      senderId: null, 
    }));

    await Notification.insertMany(notifications);

    console.log('Notifications sent to all users.');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error sending notifications:', error);
    mongoose.connection.close();
  }
}

// Send notifications with a specific title and content
const notificationTitle = 'Bug report'
const notificationContent = 'K₽10.000 were added to your account';

sendNotificationToAll(notificationTitle, notificationContent);
