/**
 * Helper untuk template variabel waktu
 */
export function getTimeVariables() {
  const now = new Date();
  const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  
  return {
    date: now.toLocaleDateString('id-ID', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    }),
    time: now.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    weekday_id: weekdays[now.getDay()],
  };
}

/**
 * Replace template variables dalam message
 */
export function fillMessageTemplate(template) {
  const vars = getTimeVariables();
  return template
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{time\}\}/g, vars.time)
    .replace(/\{\{weekday_id\}\}/g, vars.weekday_id);
}