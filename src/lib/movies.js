// Tamil movie spotlight — [title, year, lead, music director, genre, accent colors]
// Exact, verified popular songs for each film (searched by title + film, so the right track plays).
const SONGS = {"Roja": ["Chinna Chinna Aasai", "Kadhal Rojave", "Pudhu Vellai Mazhai"], "Thalapathi": ["Rakkamma Kaiya Thattu", "Sundari Kannal Oru Sethi", "Chinna Thayaval"], "Mouna Ragam": ["Oho Megam Vandhatho", "Mandram Vandha", "Nilave Vaa"], "Alaipayuthey": ["Snehidhane", "Pachai Nirame", "September Madham", "Kadhal Sadugudu"], "Minnale": ["Vaseegara", "Ivan Yaaro", "Azhagiya Theeye"], "Kaakha Kaakha": ["Uyirin Uyire", "Ennai Konjam Maatri", "Oru Oorla Oru Rajakumari"], "Autograph": ["Ovvoru Pookalume", "Mella Mella", "Meesai Vecha Kuyilu"], "Vaaranam Aayiram": ["Anjala", "Mundhinam Paartheney", "Nenjukkul Peidhidum", "Ava Enna Enna"], "Enthiran": ["Kilimanjaro", "Arima Arima", "Irumbile Oru Idhayam"], "Vinnaithaandi Varuvaayaa": ["Hosanna", "Omana Penne", "Mannipaaya", "Aaromale"], "Thuppakki": ["Google Google", "Antartica", "Kutti Puli Kootam"], "96": ["Kaathalae Kaathalae", "The Life of Ram", "Anthaathi", "Vasantha Kaalangal"], "Master": ["Vaathi Coming", "Kutti Story", "Vaathi Raid", "Andha Kanna Paathaakaa"], "Vikram": ["Pathala Pathala", "Porkanda Singam", "Vikram Title Track"], "Ponniyin Selvan: I": ["Ponni Nadhi", "Chola Chola", "Devaralan Aattam", "Alaikadal"], "Jailer": ["Kaavaalaa", "Hukum", "Jujubee"]};
export const MOVIES = [
  ['Roja', 1992, 'Arvind Swamy, Madhoo', 'A. R. Rahman', 'Romance', ['#ff4d8d', '#ffb86b']],
  ['Thalapathi', 1991, 'Rajinikanth, Mammootty', 'Ilaiyaraaja', 'Drama', ['#8b5cf6', '#2dd4bf']],
  ['Mouna Ragam', 1986, 'Mohan, Revathi', 'Ilaiyaraaja', 'Romance', ['#ff7aa8', '#8b5cf6']],
  ['Alaipayuthey', 2000, 'Madhavan, Shalini', 'A. R. Rahman', 'Romance', ['#60a5fa', '#c084fc']],
  ['Minnale', 2001, 'Madhavan, Abbas', 'Harris Jayaraj', 'Romance', ['#ff4d8d', '#fbbf24']],
  ['Kaakha Kaakha', 2003, 'Suriya, Jyothika', 'Harris Jayaraj', 'Action', ['#ef4444', '#8b5cf6']],
  ['Autograph', 2004, 'Cheran, Gopika', 'Bharadwaj', 'Drama', ['#fbbf24', '#ff7aa8']],
  ['Vaaranam Aayiram', 2008, 'Suriya, Simran', 'Harris Jayaraj', 'Drama', ['#2dd4bf', '#8b5cf6']],
  ['Enthiran', 2010, 'Rajinikanth, Aishwarya Rai', 'A. R. Rahman', 'Sci-fi', ['#60a5fa', '#ff4d8d']],
  ['Vinnaithaandi Varuvaayaa', 2010, 'Silambarasan, Trisha', 'A. R. Rahman', 'Romance', ['#c084fc', '#ffb86b']],
  ['Thuppakki', 2012, 'Vijay, Kajal Aggarwal', 'Harris Jayaraj', 'Action', ['#ef4444', '#fbbf24']],
  ['96', 2018, 'Vijay Sethupathi, Trisha', 'Govind Vasantha', 'Romance', ['#ff7aa8', '#60a5fa']],
  ['Master', 2021, 'Vijay, Vijay Sethupathi', 'Anirudh Ravichander', 'Action', ['#8b5cf6', '#ff4d8d']],
  ['Vikram', 2022, 'Kamal Haasan, Fahadh Faasil', 'Anirudh Ravichander', 'Action', ['#ef4444', '#8b5cf6']],
  ['Ponniyin Selvan: I', 2022, 'Vikram, Aishwarya Rai, Karthi', 'A. R. Rahman', 'Epic', ['#fbbf24', '#2dd4bf']],
  ['Jailer', 2023, 'Rajinikanth, Mohanlal', 'Anirudh Ravichander', 'Action', ['#ffb86b', '#ef4444']],
]// Newest films first.
.map(([title, year, lead, music, genre, colors]) => ({ title, year, lead, music, genre, colors, songs: SONGS[title] || [] })).sort((a, b) => b.year - a.year);
