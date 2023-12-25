const mongoose = require('mongoose');

const SlotGameSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    betAmount: {
        type: Number,
        required: true
    },
    turboMode: {
        type: Boolean,
        default: false
    },
    autoSpin: {
        type: Boolean,
        default: false
    },
    gridState: [{
        type: String,
        enum: ['red', 'blue', 'green', 'yin_yang', 'hakkero', 'yellow', 'wild'],
    }],
    lastSpinResult: {
        type: Map,
        of: Number
    },
    manekiNekoFeature: {
        isActive: Boolean,
        selectedSymbol: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SlotGame', SlotGameSchema);
