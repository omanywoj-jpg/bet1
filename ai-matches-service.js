const axios = require('axios');

/**
 * AI-Powered Matches Service
 * Fetches live sports data and generates dynamic odds using AI
 */

// Sports Data API - using free tier API-Football
const API_FOOTBALL_URL = 'https://api-football-v1.p.rapidapi.com/v3';
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || 'demo'; // Add to .env

// Mock AI Odds Generator (can be replaced with actual AI service)
class AIMatchesService {
  constructor() {
    this.cachedMatches = [];
    this.lastUpdate = null;
  }

  /**
   * Calculate odds using AI-based logic
   * Factors: team strength, recent form, head-to-head, goals
   */
  generateDynamicOdds(match) {
    const homeTeam = match.teams.home;
    const awayTeam = match.teams.away;
    const goals = match.goals;

    // Simulate team strength ratings (0-100)
    const homeStrength = this.getTeamStrength(homeTeam.name);
    const awayStrength = this.getTeamStrength(awayTeam.name);

    // Base odds calculation
    const strengthDiff = homeStrength - awayStrength;
    const homeOdds = parseFloat((2.0 - strengthDiff / 200).toFixed(2));
    const drawOdds = parseFloat((3.0 - Math.abs(strengthDiff) / 300).toFixed(2));
    const awayOdds = parseFloat((2.0 + strengthDiff / 200).toFixed(2));

    // Adjust based on current score
    const goalDiff = goals.home - goals.away;
    const homeAdjustment = goalDiff > 0 ? 1.1 : goalDiff < 0 ? 0.9 : 1.0;
    const awayAdjustment = goalDiff < 0 ? 1.1 : goalDiff > 0 ? 0.9 : 1.0;

    return {
      home: parseFloat((homeOdds * homeAdjustment).toFixed(2)),
      draw: drawOdds,
      away: parseFloat((awayOdds * awayAdjustment).toFixed(2)),
    };
  }

  /**
   * AI Team Strength Evaluator
   */
  getTeamStrength(teamName) {
    const teamStrengths = {
      'Arsenal': 78,
      'Chelsea': 75,
      'Barcelona': 82,
      'Real Madrid': 85,
      'Manchester City': 88,
      'PSG': 83,
      'Gor Mahia': 70,
      'AFC Leopards': 68,
      'Lakers': 80,
      'Warriors': 82,
      'Manchester United': 76,
      'Liverpool': 79,
      'Bayern Munich': 84,
    };
    return teamStrengths[teamName] || 72;
  }

  /**
   * Fetch live matches from API
   */
  async fetchLiveMatches() {
    try {
      // Using rapid API football data
      const options = {
        method: 'GET',
        url: `${API_FOOTBALL_URL}/fixtures`,
        params: {
          live: 'all',
          limit: 10,
        },
        headers: {
          'X-RapidAPI-Key': process.env.API_FOOTBALL_KEY || 'demo-key',
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
        },
      };

      // For demo, return mock data if API key not provided
      if (process.env.API_FOOTBALL_KEY === 'demo' || !process.env.API_FOOTBALL_KEY) {
        return this.getMockMatches();
      }

      const response = await axios.request(options);
      return this.formatMatches(response.data.response);
    } catch (error) {
      console.warn('API Football fetch failed, using mock data:', error.message);
      return this.getMockMatches();
    }
  }

  /**
   * Format API matches to app format
   */
  formatMatches(apiMatches) {
    return apiMatches.map((match) => {
      const odds = this.generateDynamicOdds(match);
      const elapsedTime = this.calculateElapsedTime(match.fixture.status);

      return {
        id: match.fixture.id,
        league: match.league.name,
        leagueFlag: match.league.flag || '🏆',
        status: match.fixture.status.long,
        isLive: match.fixture.status.short === 'LIVE',
        elapsedTime,
        teams: {
          home: {
            name: match.teams.home.name,
            logo: match.teams.home.logo,
          },
          away: {
            name: match.teams.away.name,
            logo: match.teams.away.logo,
          },
        },
        goals: {
          home: match.goals.home || 0,
          away: match.goals.away || 0,
        },
        odds: odds,
        timestamp: match.fixture.timestamp,
      };
    });
  }

  /**
   * Calculate elapsed time from fixture status
   */
  calculateElapsedTime(status) {
    const minute = status.elapsed || 0;
    if (status.short === 'LIVE') {
      return `LIVE ${minute}'`;
    } else if (status.short === 'NS') {
      return 'Not Started';
    } else if (status.short === 'FT') {
      return 'Final';
    }
    return minute > 0 ? `${minute}'` : status.long;
  }

  /**
   * Mock matches data (for demo without API key)
   */
  getMockMatches() {
    const now = Date.now();
    return [
      {
        id: 1,
        league: 'Premier League',
        leagueFlag: '🏆',
        status: 'In Play',
        isLive: true,
        elapsedTime: `LIVE ${Math.floor(Math.random() * 90)}'`,
        teams: {
          home: { name: 'Arsenal', logo: '🔴' },
          away: { name: 'Chelsea', logo: '🔵' },
        },
        goals: { home: 2, away: 1 },
        odds: { home: 1.85, draw: 3.4, away: 4.2 },
        timestamp: now,
      },
      {
        id: 2,
        league: 'La Liga',
        leagueFlag: '🏆',
        status: 'In Play',
        isLive: true,
        elapsedTime: `LIVE ${Math.floor(Math.random() * 90)}'`,
        teams: {
          home: { name: 'Barcelona', logo: '🔵' },
          away: { name: 'Real Madrid', logo: '⚪' },
        },
        goals: { home: 1, away: 0 },
        odds: { home: 2.1, draw: 3.2, away: 3.75 },
        timestamp: now,
      },
      {
        id: 3,
        league: 'KPL',
        leagueFlag: '🏆',
        status: 'In Play',
        isLive: true,
        elapsedTime: `LIVE ${Math.floor(Math.random() * 90)}'`,
        teams: {
          home: { name: 'Gor Mahia', logo: '⚫' },
          away: { name: 'AFC Leopards', logo: '🟨' },
        },
        goals: { home: 0, away: 0 },
        odds: { home: 2.5, draw: 2.9, away: 3.1 },
        timestamp: now,
      },
      {
        id: 4,
        league: 'NBA',
        leagueFlag: '🏀',
        status: 'In Play',
        isLive: true,
        elapsedTime: `LIVE Q${Math.floor(Math.random() * 4) + 1}`,
        teams: {
          home: { name: 'Lakers', logo: '🟣' },
          away: { name: 'Warriors', logo: '🟡' },
        },
        goals: { home: 78, away: 82 },
        odds: { home: 1.95, draw: null, away: 1.9 },
        timestamp: now,
      },
    ];
  }

  /**
   * Generate upcoming matches
   */
  getUpcomingMatches() {
    const upcoming = [];
    const now = new Date();
    const timeSlots = [3, 6, 12, 24]; // hours ahead

    const teams = [
      { home: 'Man City', away: 'PSG' },
      { home: 'Liverpool', away: 'Man United' },
      { home: 'Bayern Munich', away: 'Juventus' },
    ];

    teams.forEach((match, idx) => {
      const matchTime = new Date(now.getTime() + timeSlots[idx] * 3600000);
      upcoming.push({
        id: 100 + idx,
        league: 'Champions League',
        leagueFlag: '🏆',
        status: 'Scheduled',
        isLive: false,
        elapsedTime: this.formatTimeUntil(matchTime),
        teams: {
          home: { name: match.home, logo: '���' },
          away: { name: match.away, logo: '⚫' },
        },
        goals: { home: null, away: null },
        odds: this.generateDynamicOdds({
          teams: {
            home: { name: match.home },
            away: { name: match.away },
          },
          goals: { home: 0, away: 0 },
        }),
        timestamp: matchTime.getTime(),
      });
    });

    return upcoming;
  }

  /**
   * Format time until match starts
   */
  formatTimeUntil(matchTime) {
    const now = new Date();
    const diff = matchTime - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 24) {
      return `Tomorrow ${matchTime.getHours()}:00`;
    } else if (hours > 0) {
      return `Today ${matchTime.getHours()}:00`;
    }
    return `${hours}h ${minutes}m`;
  }

  /**
   * Update odds dynamically (simulate live odds changes)
   */
  updateOdds(match) {
    // Simulate odds movement based on goals
    const odds = this.generateDynamicOdds(match);
    const variation = 0.95 + Math.random() * 0.1; // 5% variance
    return {
      home: parseFloat((odds.home * variation).toFixed(2)),
      draw: parseFloat((odds.draw * variation).toFixed(2)),
      away: parseFloat((odds.away * variation).toFixed(2)),
    };
  }

  /**
   * Get all matches (live + upcoming)
   */
  async getAllMatches() {
    const liveMatches = await this.fetchLiveMatches();
    const upcomingMatches = this.getUpcomingMatches();
    return {
      live: liveMatches,
      upcoming: upcomingMatches,
      total: liveMatches.length + upcomingMatches.length,
    };
  }
}

module.exports = new AIMatchesService();
