import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const readers = [
  { name: "Amina N.", town: "Nairobi", area: "Westlands", lat: -1.27, lng: 36.81, genres: ["Fiction", "Mystery"] },
  { name: "Brian K.", town: "Nairobi", area: "Kasarani", lat: -1.22, lng: 36.90, genres: ["History", "Biography"] },
  { name: "Wanjiku M.", town: "Nairobi", area: "South B", lat: -1.32, lng: 36.84, genres: ["Romance", "Fiction"] },
  { name: "Kevin O.", town: "Nairobi", area: "Ongata Rongai", lat: -1.40, lng: 36.75, genres: ["Science", "Fantasy"] },
  { name: "Faith W.", town: "Nairobi", area: "Karen", lat: -1.32, lng: 36.71, genres: ["Children", "Fiction"] },
  { name: "Peter L.", town: "Narok", area: "Narok Town", lat: -1.08, lng: 35.87, genres: ["History", "Fiction"] },
  { name: "Mary N.", town: "Narok", area: "Narok Town", lat: -1.09, lng: 35.87, genres: ["Romance", "Self-help"] },
  { name: "Daniel S.", town: "Nairobi", area: "Eastleigh", lat: -1.28, lng: 36.85, genres: ["Business", "Biography"] },
  { name: "Joy C.", town: "Nairobi", area: "Kileleshwa", lat: -1.28, lng: 36.79, genres: ["Poetry", "Fiction"] },
  { name: "Samuel T.", town: "Narok", area: "Narok Town", lat: -1.07, lng: 35.88, genres: ["Adventure", "Mystery"] },
];

// Sample catalogue records for local demos; they are not official recommendations or endorsements.
const sampleBooks = [
  ["Things Fall Apart", "Chinua Achebe", "Fiction", "English"],
  ["The River and the Source", "Margaret A. Ogola", "Fiction", "English"],
  ["A Grain of Wheat", "Ngũgĩ wa Thiong'o", "Fiction", "English"],
  ["The Concubine", "Elechi Amadi", "Fiction", "English"],
  ["The Old Man and the Sea", "Ernest Hemingway", "Fiction", "English"],
  ["Animal Farm", "George Orwell", "Fiction", "English"],
  ["The Alchemist", "Paulo Coelho", "Fiction", "English"],
  ["Born a Crime", "Trevor Noah", "Biography", "English"],
  ["The Book Thief", "Markus Zusak", "Historical fiction", "English"],
  ["Purple Hibiscus", "Chimamanda Ngozi Adichie", "Fiction", "English"],
  ["Weep Not, Child", "Ngũgĩ wa Thiong'o", "Fiction", "English"],
  ["The Pearl", "John Steinbeck", "Fiction", "English"],
  ["Kigogo", "Pauline Kea", "Drama", "Kiswahili"],
  ["Bembea ya Maisha", "John Ruganda", "Drama", "Kiswahili"],
  ["Kidagaa Kimemwozea", "Ken Walibora", "Fiction", "Kiswahili"],
  ["Siku Njema", "Ken Walibora", "Fiction", "Kiswahili"],
  ["Blossoms of the Savannah", "Henry R. Ole Kulet", "Fiction", "English"],
  ["The Whale Rider", "Witi Ihimaera", "Fiction", "English"],
  ["The Boy at the Back of the Class", "Onjali Q. Raúf", "Children", "English"],
  ["Charlotte's Web", "E. B. White", "Children", "English"],
  ["Matilda", "Roald Dahl", "Children", "English"],
  ["The Little Prince", "Antoine de Saint-Exupéry", "Children", "English"],
  ["The Hobbit", "J. R. R. Tolkien", "Fantasy", "English"],
  ["Harry Potter and the Philosopher's Stone", "J. K. Rowling", "Fantasy", "English"],
  ["The Lion, the Witch and the Wardrobe", "C. S. Lewis", "Fantasy", "English"],
  ["The Seven Habits of Highly Effective People", "Stephen R. Covey", "Self-help", "English"],
  ["Atomic Habits", "James Clear", "Self-help", "English"],
  ["Long Walk to Freedom", "Nelson Mandela", "Biography", "English"],
  ["The Diary of a Young Girl", "Anne Frank", "Biography", "English"],
  ["Steve Jobs", "Walter Isaacson", "Biography", "English"],
  ["Outliers", "Malcolm Gladwell", "Business", "English"],
  ["The Lean Startup", "Eric Ries", "Business", "English"],
  ["A Brief History of Time", "Stephen Hawking", "Science", "English"],
  ["The Curious Incident of the Dog in the Night-Time", "Mark Haddon", "Mystery", "English"],
  ["And Then There Were None", "Agatha Christie", "Mystery", "English"],
  ["The No. 1 Ladies' Detective Agency", "Alexander McCall Smith", "Mystery", "English"],
  ["A Man of the People", "Chinua Achebe", "Fiction", "English"],
  ["So Long a Letter", "Mariama Bâ", "Fiction", "English"],
  ["The Girl with the Louding Voice", "Abi Daré", "Fiction", "English"],
  ["The Happiest Man on Earth", "Eddie Jaku", "Biography", "English"],
];

function stableUuid(value) {
  const hex = createHash("sha1").update(`bookswap-seed:${value}`).digest("hex").slice(0, 32);
  const versioned = `${hex.slice(0, 12)}5${hex.slice(13)}`;
  const variant = ((Number.parseInt(versioned[16], 16) & 0x3) | 0x8).toString(16);
  const finalHex = `${versioned.slice(0, 16)}${variant}${versioned.slice(17)}`;
  return `${finalHex.slice(0, 8)}-${finalHex.slice(8, 12)}-${finalHex.slice(12, 16)}-${finalHex.slice(16, 20)}-${finalHex.slice(20)}`;
}

const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

const existingByEmail = new Map(listData.users.map((user) => [user.email, user]));
const userIds = [];
for (const [index, reader] of readers.entries()) {
  const email = `reader${String(index + 1).padStart(2, "0")}@bookswap.example`;
  let user = existingByEmail.get(email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
      user_metadata: { display_name: reader.name },
    });
    if (error || !data.user) throw error ?? new Error(`Could not create demo account ${email}`);
    user = data.user;
  }
  userIds.push(user.id);

  const username = `demo-reader-${String(index + 1).padStart(2, "0")}`;
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    username,
    display_name: reader.name,
    town: reader.town,
    area: reader.area,
    area_lat: reader.lat,
    area_lng: reader.lng,
    favorite_genres: reader.genres,
  }, { onConflict: "id" });
  if (profileError) throw profileError;
}

const books = sampleBooks.map(([title, author, genre, language], index) => {
  const readerIndex = index % readers.length;
  const reader = readers[readerIndex];
  const condition = ["good", "like_new", "fair", "good"][index % 4];
  return {
    id: stableUuid(`book-${index + 1}`),
    owner_id: userIds[readerIndex],
    title,
    author,
    genre,
    language,
    condition,
    status: "available",
    accepts_credits: index % 3 === 0,
    area_name: reader.area,
    area_lat: reader.lat,
    area_lng: reader.lng,
    personal_note: "Sample listing for the BookSwap demo.",
  };
});

const { error: booksError } = await supabase.from("books").upsert(books, { onConflict: "id" });
if (booksError) throw booksError;

console.info(`Demo seed complete: ${readers.length} reader profiles and ${books.length} sample books.`);
