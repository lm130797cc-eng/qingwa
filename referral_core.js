// REFERRAL CORE
// 推荐关系 + 积分计算

const REFERRAL_POINTS = 10;
const REPORT_COST = 50;

class ReferralSystem {
  constructor(db) {
    this.db = db; // Assume simple key-value store or SQL connection
  }

  // Create new user profile
  async createUser(userId, referrerId = null) {
    const user = {
      id: userId,
      points: 0,
      referrer: referrerId,
      level: 'Novice'
    };
    
    // If referred, credit points to referrer
    if (referrerId) {
      await this.addPoints(referrerId, REFERRAL_POINTS);
    }
    
    return user;
  }

  // Add points to a user
  async addPoints(userId, amount) {
    const user = await this.db.getUser(userId);
    user.points += amount;
    
    // Check level up
    if (user.points > 100) user.level = 'Disciple';
    if (user.points > 1000) user.level = 'Master';
    
    await this.db.saveUser(user);
    return user;
  }

  // Deduct points for report unlock
  async deductPoints(userId, cost = REPORT_COST) {
    const user = await this.db.getUser(userId);
    if (user.points < cost) {
      throw new Error("Insufficient points");
    }
    user.points -= cost;
    await this.db.saveUser(user);
    return true;
  }
}

module.exports = ReferralSystem;
