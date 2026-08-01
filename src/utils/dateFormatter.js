export const formatDateIndo = (dateInput) => {
  if (!dateInput) return '-';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;
    
    const day = date.getDate();
    const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  } catch (e) {
    return dateInput;
  }
};
