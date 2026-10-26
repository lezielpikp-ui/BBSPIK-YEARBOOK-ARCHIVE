import { Yearbook } from '../types/yearbook';

export interface SamplePageData {
  pageNumber: number;
  type: 'cover' | 'inner' | 'back-cover';
  title: string;
  category: string;
  renderType: 'cover' | 'principal' | 'portraits' | 'athletics' | 'arts' | 'campus' | 'clubs' | 'autographs' | 'back';
  subtitle?: string;
  content: any;
}

export function getSampleYearbookPages(yearbook: Yearbook): SamplePageData[] {
  const year = yearbook.year || 2024;
  const title = yearbook.title;

  return [
    // Page 1: Hardcover Front
    {
      pageNumber: 1,
      type: 'cover',
      category: 'Cover',
      renderType: 'cover',
      title: title,
      content: {
        coverImage: yearbook.coverImage,
        year: year,
        motto: 'Gloria Dei Vivens Homo • Bina Bangsa School PIK',
        edition: `${year} Academic Annual Chronicle`,
      },
    },

    // Page 2: Inside Front & Principal's Foreword
    {
      pageNumber: 2,
      type: 'inner',
      category: 'Foreword',
      renderType: 'principal',
      title: "Headmaster's Dedication",
      subtitle: `Reflections on the Academic Year ${year}`,
      content: {
        principalName: year > 2000 ? 'Dr. Elizabeth Sterling, Ph.D.' : 'Prof. Arthur M. Vance, M.A.',
        quote: year === 2024
          ? '“One hundred years of tradition walk beside you as you step forward into an extraordinary future.”'
          : year === 2020
          ? '“In an unprecedented hour, our spirit burned brighter than distance could ever dim.”'
          : '“To strive, to seek, to find, and not to yield. The corridors of this academy will forever hold your footsteps.”',
        text: [
          `As we present this volume of the annual archive for ${year}, we honor the resilience, relentless curiosity, and collective heart of our student body.`,
          `Through countless examinations, athletic triumphs in pouring rain, late nights in the studio, and lifelong friendships forged under the campus elms, each member of this class has etched an indelible mark.`,
          `Carry forward the values of integrity, empathy, and courage that have defined our heritage since the first cornerstone was laid.`,
        ],
        signatureDate: `May ${year}`,
      },
    },

    // Page 3: Senior Class Portraits
    {
      pageNumber: 3,
      type: 'inner',
      category: 'Seniors',
      renderType: 'portraits',
      title: 'Senior Class Gallery',
      subtitle: `Honoring the Graduating Class of ${year}`,
      content: {
        students: [
          {
            name: 'Alexander Chen',
            role: 'Valedictorian',
            quote: '“The horizon is only the limit of our sight.”',
            superlative: 'Most Likely to Succeed',
            activities: 'Debate Captain • Math Olympiad',
            color: '#3b82f6',
          },
          {
            name: 'Maya Patel',
            role: 'Salutatorian',
            quote: '“Leave the world a little kinder than you found it.”',
            superlative: 'Best Heart',
            activities: 'Student Council VP • Eco-Club',
            color: '#ec4899',
          },
          {
            name: 'Julian Vance',
            role: 'Senior Class President',
            quote: '“Four years felt like four minutes. Make every second count.”',
            superlative: 'Class Leader',
            activities: 'Varsity Soccer • Jazz Band',
            color: '#10b981',
          },
          {
            name: 'Sophia Laurent',
            role: 'Editor-in-Chief',
            quote: '“Ink dries, but memory stays alive in these pages.”',
            superlative: 'Most Creative',
            activities: 'Yearbook Staff • Literary Journal',
            color: '#8b5cf6',
          },
          {
            name: 'Marcus Brody',
            role: 'Honor Council',
            quote: '“Hard work beats talent when talent doesn’t work hard.”',
            superlative: 'Most Athletic',
            activities: 'Track & Field • Basketball',
            color: '#f59e0b',
          },
          {
            name: 'Elena Rostova',
            role: 'Concertmaster',
            quote: '“Where words fail, music speaks.”',
            superlative: 'Most Musical',
            activities: 'Chamber Orchestra • Drama Guild',
            color: '#06b6d4',
          },
        ],
      },
    },

    // Page 4: Academics & Faculty Tributes
    {
      pageNumber: 4,
      type: 'inner',
      category: 'Academics',
      renderType: 'campus',
      title: 'Academics & Faculty Honors',
      subtitle: 'Mentorship, Discovery & Scientific Endeavors',
      content: {
        highlights: [
          {
            dept: 'Sciences & Research',
            lead: 'Dr. Raymond Carver, Chair',
            note: 'National Science Fair Finalists for renewable solar biocatalyst research.',
          },
          {
            dept: 'Humanities & Literature',
            lead: 'Prof. Clara Higgins',
            note: 'Published 32 student essays and original poetry compilations.',
          },
          {
            dept: 'Advanced Mathematics',
            lead: 'Dr. Hiroshi Tanaka',
            note: 'First place regional sweep at the State Calculus Invitational.',
          },
          {
            dept: 'Classical & Fine Arts',
            lead: 'Mme. Vivienne Dubois',
            note: 'Annual spring gallery exhibiting 140 original student oil paintings & ceramics.',
          },
        ],
      },
    },

    // Page 5: Athletics & Championship Records
    {
      pageNumber: 5,
      type: 'inner',
      category: 'Athletics',
      renderType: 'athletics',
      title: 'Varsity Athletics & Champions',
      subtitle: `State Championship Season ${year}`,
      content: {
        record: '18 Wins — 2 Losses',
        summary: `The varsity squad captured the historic championship pennant after a breathtaking overtime finish in the state final.`,
        teams: [
          { name: 'Varsity Basketball', record: '22-3', highlight: 'League Champions' },
          { name: 'Cross Country & Track', record: 'Undefeated', highlight: 'State 4x400 Gold' },
          { name: 'Varsity Swimming', record: '14-2', highlight: 'School Record in 200m Free' },
          { name: 'Women’s Tennis', record: '16-1', highlight: 'Regional Semifinalists' },
        ],
      },
    },

    // Page 6: Performing Arts & Stage
    {
      pageNumber: 6,
      type: 'inner',
      category: 'Arts',
      renderType: 'arts',
      title: 'Stage, Symphony & Spectacle',
      subtitle: `Annual Spring Production & Concert Season`,
      content: {
        production: year > 2010 ? 'Les Misérables' : year > 1990 ? 'Into the Woods' : 'Fiddler on the Roof',
        director: 'Director Sarah Jenkins',
        awards: 'Five Regional Theatre Awards, including Best Ensemble & Best Musical Direction',
        critique: '“A tour de force that filled the grand auditorium to capacity across six sold-out nights.”',
      },
    },

    // Page 7: Campus Life & Traditions
    {
      pageNumber: 7,
      type: 'inner',
      category: 'Traditions',
      renderType: 'campus',
      title: 'Campus Life & Unforgettable Moments',
      subtitle: 'Spirit Week, Homecoming & Autumn Bonfire',
      content: {
        traditions: [
          { title: 'The Quad Bonfire', desc: 'Lighting the senior torch the night before the homecoming rivalry game.' },
          { title: 'Spirit Day Dress-Up', desc: 'Decades day, neon fever, and the legendary hallway decoration contest.' },
          { title: 'Senior Breakfast & Prank', desc: 'Waffles on the football field followed by 5,000 sticky notes in the library.' },
          { title: 'The Midnight Stargaze', desc: 'Astrophysics club campout on the observatory lawn.' },
        ],
      },
    },

    // Page 8: Clubs & Student Societies
    {
      pageNumber: 8,
      type: 'inner',
      category: 'Clubs',
      renderType: 'clubs',
      title: 'Clubs & Student Societies',
      subtitle: 'Where Passion Meets Purpose',
      content: {
        clubs: [
          { name: 'Robotics & AI Guild', members: 42, feat: 'Regional FIRST Robotics winners' },
          { name: 'Forensics & Debate Union', members: 28, feat: 'Undefeated in parliamentary debate' },
          { name: 'Model United Nations', members: 35, feat: 'Best Delegation at National Conference' },
          { name: 'Community Outreach Coalition', members: 110, feat: 'Raised $24,000 for local children’s shelter' },
          { name: 'Archival & History Guild', members: 18, feat: 'Preserved 50 years of student newspapers' },
          { name: 'Culinary & Baking Society', members: 45, feat: 'Weekly Friday campus pastry fundraisers' },
        ],
      },
    },

    // Page 9: Autographs & Notes
    {
      pageNumber: 9,
      type: 'inner',
      category: 'Autographs',
      renderType: 'autographs',
      title: 'Autographs & Memories',
      subtitle: 'Words from Friends and Classmates',
      content: {
        messages: [
          { sender: 'Maya P.', text: 'Best lab partner ever! Thanks for not letting me blow up the bunsen burner!', slant: '-2deg', ink: '#1e3a8a' },
          { sender: 'Coach Vance', text: 'Proud of you, champ. Keep your head high and never stop running.', slant: '1.5deg', ink: '#111827' },
          { sender: 'Alex C.', text: 'Remember 3rd period physics? Good luck at Stanford! Stay in touch!', slant: '-1deg', ink: '#065f46' },
          { sender: 'Sophia L.', text: 'We actually finished this yearbook on time! Don’t forget us when you become famous!', slant: '3deg', ink: '#991b1b' },
          { sender: 'Elena R.', text: 'Duet practice was the highlight of senior year. Keep playing your heart out.', slant: '-2.5deg', ink: '#581c87' },
          { sender: 'Marcus B.', text: 'Championship ring is in the mail! See you at the 10-year reunion!', slant: '1deg', ink: '#1e3a8a' },
        ],
      },
    },

    // Page 10: Hardcover Back
    {
      pageNumber: 10,
      type: 'back-cover',
      category: 'Back Cover',
      renderType: 'back',
      title: 'Back Cover',
      content: {
        colophon: `Published by Bina Bangsa School PIK Editorial Board • Preserved in Public Digital Archive`,
        publisher: 'Bina Bangsa School Pantai Indah Kapuk',
        year: year,
        motto: '“Gloria Dei Vivens Homo — The Glory of God is Man Fully Alive”',
      },
    },
  ];
}
