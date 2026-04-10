import moment from 'moment';
import { BG_MONTHS } from '../date';

export function buildBirthLabel(birth: moment.Moment): string {
  return `🎂❤️ Рождена дата<br/>${BG_MONTHS[birth.month()]} ${birth.year()}`;
}

export function buildAgeLabel(birth: moment.Moment, now: moment.Moment): string {
  const years = now.diff(birth, 'years');
  const months = now.diff(birth.clone().add(years, 'years'), 'months');
  return `📅 днес, ${now.date()} ${BG_MONTHS[now.month()]} ${now.year()}<br/><span style="color:#22c55e;font-weight:600">На ${years} г. ${months} мес.</span>`;
}

export function buildTodayLabel(): string {
  const m = moment();
  return `📅 днес, ${m.date()} ${BG_MONTHS[m.month()]} ${m.year()}`;
}

export function buildDurationLabel(birth: moment.Moment, duration: number): string {
  const target = birth.clone().add(duration, 'years');
  return `⏳ ${duration} г. по-късно<br/>${BG_MONTHS[target.month()]} ${target.year()}`;
}

export function buildBirthDateSeries(from: Date, durationYears?: number): any {
  const series: any = {
    id: 'custom-date-mark',
    type: 'line',
    data: [[+from]],
    xAxisIndex: 0,
    yAxisIndex: 0,
    markLine: {
      silent: false,
      symbol: 'none',
      animation: false,
      lineStyle: { color: '#d946ef', width: 3, type: 'solid' },
      label: { show: false },
      tooltip: { formatter: buildBirthLabel(moment(from)) },
      data: [{ xAxis: +from }],
    },
  };
  if (durationYears) {
    const to = new Date(from);
    to.setFullYear(to.getFullYear() + durationYears);
    series.markArea = {
      silent: true,
      itemStyle: { color: 'rgba(217, 70, 239, 0.12)' },
      data: [[{ xAxis: +from }, { xAxis: +to }]],
    };
  }
  return series;
}

export function buildDurationDateSeries(from: Date, durationYears: number): any {
  const target = new Date(from);
  target.setFullYear(target.getFullYear() + durationYears);
  return {
    id: 'custom-duration-mark',
    type: 'line',
    data: [[+target]],
    xAxisIndex: 0,
    yAxisIndex: 0,
    markLine: {
      silent: false,
      symbol: 'none',
      animation: false,
      lineStyle: { color: '#ff6b35', width: 3, type: 'solid' },
      label: { show: false },
      tooltip: { formatter: buildDurationLabel(moment(from), durationYears) },
      data: [{ xAxis: +target }],
    },
  };
}
