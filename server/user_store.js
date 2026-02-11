const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure data file exists (only if not on Vercel)
if (!process.env.VERCEL && !fs.existsSync(DATA_FILE)) {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

class UserStore {
    constructor() {
        this.users = this.load();
    }

    load() {
        if (process.env.VERCEL) {
            return {}; // In-memory store for Vercel (non-persistent)
        }
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error("Failed to load user data:", e);
            return {};
        }
    }

    save() {
        if (process.env.VERCEL) {
            return; // No-op for Vercel
        }
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.users, null, 2));
        } catch (e) {
            console.error("Failed to save user data:", e);
        }
    }

    getUser(apiKey) {
        if (!this.users[apiKey]) {
            this.users[apiKey] = {
                points: 0,
                lastLogin: null,
                history: []
            };
            this.save();
        }
        return this.users[apiKey];
    }

    checkDailyLogin(apiKey) {
        const user = this.getUser(apiKey);
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        if (user.lastLogin !== today) {
            user.points += 50;
            user.lastLogin = today;
            this.save();
            return { awarded: true, points: user.points };
        }
        return { awarded: false, points: user.points };
    }

    updatePoints(apiKey, amount) {
        const user = this.getUser(apiKey);
        user.points += amount;
        this.save();
        return user.points;
    }

    getPoints(apiKey) {
        return this.getUser(apiKey).points;
    }
}

module.exports = new UserStore();
