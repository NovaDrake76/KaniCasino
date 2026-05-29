const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/authMiddleware");
const User = require("../models/User");
const Notification = require("../models/Notification");

const PUBLIC_FIELDS = "username profilePicture level fixedItem";

module.exports = (io) => {
  // my friends and incoming requests
  router.get("/me", isAuthenticated, async (req, res) => {
    try {
      const me = await User.findById(req.user._id)
        .populate("friends", PUBLIC_FIELDS)
        .populate("friendRequests", PUBLIC_FIELDS);

      if (!me) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ friends: me.friends, requests: me.friendRequests });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // a user's public friends list
  router.get("/list/:id", async (req, res) => {
    try {
      const user = await User.findById(req.params.id).populate("friends", PUBLIC_FIELDS);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ friends: user.friends });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // my relationship with another user
  router.get("/status/:id", isAuthenticated, async (req, res) => {
    try {
      const targetId = req.params.id;
      if (targetId === req.user._id.toString()) {
        return res.json({ status: "self" });
      }

      const target = await User.findById(targetId).select("friendRequests");
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }

      const has = (list, id) => list.some((x) => x.toString() === id.toString());

      let status = "none";
      if (has(req.user.friends, targetId)) {
        status = "friends";
      } else if (has(target.friendRequests, req.user._id)) {
        status = "requested"; // i already sent one
      } else if (has(req.user.friendRequests, targetId)) {
        status = "incoming"; // they sent me one
      }

      res.json({ status });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // send a friend request
  router.post("/request/:id", isAuthenticated, async (req, res) => {
    try {
      const targetId = req.params.id;
      const meId = req.user._id;

      if (targetId === meId.toString()) {
        return res.status(400).json({ message: "You can't add yourself" });
      }

      const target = await User.findById(targetId);
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }

      const has = (list, id) => list.some((x) => x.toString() === id.toString());

      if (has(req.user.friends, targetId)) {
        return res.status(400).json({ message: "You are already friends" });
      }
      // if they already requested me, treat it as accepting
      if (has(req.user.friendRequests, targetId)) {
        return res.status(400).json({ message: "This user already sent you a request" });
      }
      if (has(target.friendRequests, meId)) {
        return res.status(400).json({ message: "Request already sent" });
      }

      await User.updateOne({ _id: targetId }, { $addToSet: { friendRequests: meId } });

      const notification = new Notification({
        senderId: meId,
        receiverId: target._id,
        type: "friendRequest",
        title: "Friend request",
        content: `${req.user.username} sent you a friend request`,
      });
      await notification.save();

      io.to(target._id.toString()).emit("newNotification", {
        message: `${req.user.username} sent you a friend request`,
      });

      res.json({ message: "Friend request sent" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // accept an incoming request
  router.post("/accept/:id", isAuthenticated, async (req, res) => {
    try {
      const requesterId = req.params.id;
      const meId = req.user._id;

      const has = (list, id) => list.some((x) => x.toString() === id.toString());
      if (!has(req.user.friendRequests, requesterId)) {
        return res.status(400).json({ message: "No pending request from this user" });
      }

      // link both ways and clear the pending request
      await User.updateOne(
        { _id: meId },
        { $addToSet: { friends: requesterId }, $pull: { friendRequests: requesterId } }
      );
      await User.updateOne({ _id: requesterId }, { $addToSet: { friends: meId } });

      const requester = await User.findById(requesterId).select("username");
      if (requester) {
        const notification = new Notification({
          senderId: meId,
          receiverId: requesterId,
          type: "friendRequest",
          title: "Friend request accepted",
          content: `${req.user.username} accepted your friend request`,
        });
        await notification.save();

        io.to(requesterId.toString()).emit("newNotification", {
          message: `${req.user.username} accepted your friend request`,
        });
      }

      res.json({ message: "Friend request accepted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // decline an incoming request
  router.post("/decline/:id", isAuthenticated, async (req, res) => {
    try {
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { friendRequests: req.params.id } }
      );
      res.json({ message: "Friend request declined" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  // remove a friend (both directions)
  router.delete("/:id", isAuthenticated, async (req, res) => {
    try {
      const otherId = req.params.id;
      await User.updateOne({ _id: req.user._id }, { $pull: { friends: otherId } });
      await User.updateOne({ _id: otherId }, { $pull: { friends: req.user._id } });
      res.json({ message: "Friend removed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};
