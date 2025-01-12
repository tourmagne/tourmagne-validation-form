'use strict';

const datePlusDurationToStr = (date, duration, locale) => {
  const timeZone = 'Europe/Paris';
  const sumDate = new Date(date.getTime() + duration);
  const dateStr = sumDate.toLocaleDateString(
    locale,
    { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', timeZone },
  );
  const timeStr = sumDate.toLocaleTimeString(
    locale,
    { hour: '2-digit', minute: '2-digit', timeZone },
  );

  return {
    dateStr,
    timeStr,
  };
};

module.exports = datePlusDurationToStr;
