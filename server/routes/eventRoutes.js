const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, '../data/events.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize events file if not exists
if (!fs.existsSync(EVENTS_FILE)) {
  const defaultEvents = [
    { id: 1, name: 'Annual Fest 2026', date: '2026-03-15', description: 'Annual cultural festival' },
    { id: 2, name: 'Sports Day', date: '2026-02-20', description: 'Annual sports competition' },
    { id: 3, name: 'Cultural Night', date: '2026-04-10', description: 'Cultural performance night' },
    { id: 4, name: 'Tech Fest', date: '2026-09-05', description: 'Technology festival' },
    { id: 5, name: 'Convocation', date: '2026-07-15', description: 'Graduation ceremony' }
  ];
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(defaultEvents, null, 2));
}

// Get all events
router.get('/', (req, res) => {
  try {
    const eventsData = fs.readFileSync(EVENTS_FILE, 'utf8');
    const events = JSON.parse(eventsData);
    res.json(events);
  } catch (error) {
    console.error('Error reading events:', error);
    res.json([]);
  }
});

// Add new event
router.post('/', (req, res) => {
  try {
    const { name, date, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Event name is required' });
    }
    
    const eventsData = fs.readFileSync(EVENTS_FILE, 'utf8');
    const events = JSON.parse(eventsData);
    
    const newEvent = {
      id: Date.now(),
      name,
      date: date || new Date().toISOString().split('T')[0],
      description: description || ''
    };
    
    events.push(newEvent);
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
    
    res.json(newEvent);
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({ error: 'Failed to add event' });
  }
});

// Delete event
router.delete('/:id', (req, res) => {
  try {
    const eventsData = fs.readFileSync(EVENTS_FILE, 'utf8');
    let events = JSON.parse(eventsData);
    
    events = events.filter(e => e.id !== parseInt(req.params.id));
    
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
