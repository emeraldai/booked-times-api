export default function handler(req, res) {
  const booked_times = req.body.booked_times;

  const converted = booked_times.map(t => {
    const match = t.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (!match) return null;

    const formatted = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00Z`;
    const date = new Date(formatted);
    if (isNaN(date.getTime())) return null;

    const offset = new Date(date.getTime() + 3600000); // UTC+1
    return offset.toISOString().replace("Z", "+01:00");
  }).filter(Boolean);

  const unavailable_slots = [];
  for (let i = 0; i < converted.length; i += 2) {
    if (converted[i + 1]) {
      unavailable_slots.push({
        start: converted[i],
        end: converted[i + 1]
      });
    }
  }

  const grouped = {};
  unavailable_slots.forEach(({ start, end }) => {
    const date = start.split("T")[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push({ start, end });
  });

  const SLOT_LENGTH_MINUTES = 30;
  const WORK_START_HOUR = 9;
  const WORK_END_HOUR = 17;
  const available_slots = [];
  const all_dates = new Set(converted.map(t => t.split("T")[0]));

  all_dates.forEach(date => {
    const dayStart = new Date(`${date}T${String(WORK_START_HOUR).padStart(2, "0")}:00:00+01:00`);
    const dayEnd = new Date(`${date}T${String(WORK_END_HOUR).padStart(2, "0")}:00:00+01:00`);
    let current = new Date(dayStart);

    while (current < dayEnd) {
      const next = new Date(current.getTime() + SLOT_LENGTH_MINUTES * 60000);
      const currentISO = current.toISOString().replace("Z", "+01:00");
      const nextISO = next.toISOString().replace("Z", "+01:00");

      const overlaps = (grouped[date] || []).some(slot =>
        !(nextISO <= slot.start || currentISO >= slot.end)
      );

      if (!overlaps) {
        available_slots.push({ start: currentISO, end: nextISO });
      }

      current = next;
    }
  });

  res.status(200).json({ available_slots });
}
