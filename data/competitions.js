
const range = (start, end) =>
  Array.from(
    { length: end - start + 1 },
    (_, i) => start + i
  );

export const seasons = [
  {
    name: "Alpha",
    ids: range(1892, 1906)
  },
  {
    name: "Season 1",
    ids: [
      ...range(1907, 1908),
      ...range(1910, 1912),
      ...range(1914, 1916),
      ...range(1918, 1920),
      ...range(1922, 1924),
      ...range(1926, 1928),
      ...range(1930, 1932),
      ...range(1934, 1937)
    ]
  },
  {
    name: "Season 2",
    ids: [
      ...range(2066, 2068),
      ...range(2070, 2080)
    ]
  },
  { name: "Season 3", ids: range(2307, 2319) },
  { name: "Season 4", ids: range(2541, 2552) },
  { name: "Season 5", ids: range(2695, 2701) },
  { name: "Season 6", ids: [2828, 2829, 2831, 2832, 2833, 2834]},
  { name: "Season 7", ids: range(2924, 2930) },
  { name: "Season 8", ids: range(3038, 3044) },
  { name: "Season 9", ids: range(3130, 3136) }
];

export const competitions = seasons.flatMap(season =>
  season.ids.map(id => ({
    id,
    season: season.name
  }))
);
