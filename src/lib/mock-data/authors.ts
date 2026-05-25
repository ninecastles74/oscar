/** Stable author id from display name (matches server `authorIdFromName`). */
function authorIdFromName(name: string): string {
  let h = 0;
  const n = name.trim().toLowerCase();
  for (let i = 0; i < n.length; i++) h = (h << 5) - h + n.charCodeAt(i);
  return `author_${Math.abs(h).toString(36)}`;
}

/** Mock journalists — baseline scores until live analysis populates the reliability store. */
export interface MockAuthor {
  authorId: string;
  displayName: string;
  outlet: string;
  /** Baseline average reliability 0–100 from third-party monitors. */
  reliability: number;
}

export const AUTHORS: MockAuthor[] = [
  { authorId: authorIdFromName("Maggie Haberman")!, displayName: "Maggie Haberman", outlet: "The New York Times", reliability: 86 },
  { authorId: authorIdFromName("Peter Baker")!, displayName: "Peter Baker", outlet: "The New York Times", reliability: 88 },
  { authorId: authorIdFromName("David Leonhardt")!, displayName: "David Leonhardt", outlet: "The New York Times", reliability: 87 },
  { authorId: authorIdFromName("Glenn Thrush")!, displayName: "Glenn Thrush", outlet: "The Wall Street Journal", reliability: 84 },
  { authorId: authorIdFromName("Susan Page")!, displayName: "Susan Page", outlet: "USA Today", reliability: 82 },
  { authorId: authorIdFromName("Jake Tapper")!, displayName: "Jake Tapper", outlet: "CNN", reliability: 79 },
  { authorId: authorIdFromName("Anderson Cooper")!, displayName: "Anderson Cooper", outlet: "CNN", reliability: 78 },
  { authorId: authorIdFromName("Lester Holt")!, displayName: "Lester Holt", outlet: "NBC News", reliability: 81 },
  { authorId: authorIdFromName("Norah O'Donnell")!, displayName: "Norah O'Donnell", outlet: "CBS News", reliability: 80 },
  { authorId: authorIdFromName("Martha Raddatz")!, displayName: "Martha Raddatz", outlet: "ABC News", reliability: 83 },
  { authorId: authorIdFromName("John Dickerson")!, displayName: "John Dickerson", outlet: "CBS News", reliability: 82 },
  { authorId: authorIdFromName("Chris Wallace")!, displayName: "Chris Wallace", outlet: "CNN", reliability: 85 },
  { authorId: authorIdFromName("Bret Baier")!, displayName: "Bret Baier", outlet: "Fox News", reliability: 74 },
  { authorId: authorIdFromName("Shannon Bream")!, displayName: "Shannon Bream", outlet: "Fox News", reliability: 73 },
  { authorId: authorIdFromName("Katty Kay")!, displayName: "Katty Kay", outlet: "BBC News", reliability: 84 },
  { authorId: authorIdFromName("Laura Kuenssberg")!, displayName: "Laura Kuenssberg", outlet: "BBC News", reliability: 83 },
];

export function authorById(authorId: string): MockAuthor | undefined {
  return AUTHORS.find((a) => a.authorId === authorId);
}
