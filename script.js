// MAIN PAGE

const buttons = document.querySelectorAll('nav button');
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(btn.dataset.page);
    page.classList.add('active');

    if (btn.dataset.page === 'rankings') {
      loadRankings();
    }
  });
});

const categories = [
  "Paraphyletic_groups",
  "Plant_common_names",
  "Hydrology",
  "Coastal_geography",
  "Landforms"
];

async function fetchRandomArticleWithImage() {
  const container = document.getElementById('article');
  
  while (true) {
    try {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const catResp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:${category}&cmlimit=500&format=json&origin=*`);
      const catData = await catResp.json();
      const pages = catData.query.categorymembers;
      if (!pages.length) { container.innerHTML = 'No articles found.'; break; }
      const randomPage = pages[Math.floor(Math.random() * pages.length)];
      const title = randomPage.title;
      const pageResp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages|extracts&exintro&explaintext&format=json&pithumbsize=300&origin=*`);
      const pageData = await pageResp.json();
      const page = Object.values(pageData.query.pages)[0];
      if (page.thumbnail && page.extract) {
        let excerpt = page.extract;
        if (excerpt.length > 300) {
          excerpt = excerpt.substring(0, 300) + '…';
        }
        container.innerHTML = `
          <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank" style="display:block; padding:20px; text-decoration:none; color:white;">
            <img src="${page.thumbnail.source}" alt="${title}" style="width:60%; display:block; margin-left:auto; margin-right:auto;">
            <h3 style="font-size:20px; text-align:center;">${title}</h3>
            <p style="font-size:15px; line-height:1.4;">${excerpt}</p>
            <small>Category: ${category.replace(/_/g, ' ')}</small>
          </a>
        `;
        break;
      }
    } catch (err) {
      console.error('Error fetching Wikipedia article:', err);
      container.innerHTML = 'Failed to load article.';
      break;
    }
  }
}

fetchRandomArticleWithImage();



// CALENDAR

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabase;
  
  const daysContainer = document.getElementById("days");
  const monthYear = document.getElementById("monthYear");
  const eventList = document.getElementById("eventList");
  
  let date = new Date();
  let month = date.getMonth();
  let year = date.getFullYear();

  function formatDate(day, month, year) {
    const dd = String(day).padStart(2, "0");
    const mm = String(month + 1).padStart(2, "0");
    return `${dd}/${mm}/${year}`;
  }
  
  const globalEvents = [
    { month: 2, day: 22, name: "World Water Day" },
    { month: 3, day: 22, name: "Earth Day" },
    { month: 5, day: 5, name: "World Environment Day" },
    { month: 8, day: 16, name: "Ozone Layer Preservation Day" },
    { month: 10, day: 6, name: "Prevent Environmental Exploitation in War" },
    { month: 11, day: 5, name: "World Soil Day" },
    { month: 8, day: 20, name: "World Clean Up Day" },
    { month: 9, day: 5, name: "World Energy Efficiency Day" }
  ];
  
  async function loadCalendar() {
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    monthYear.textContent = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });
    daysContainer.innerHTML = "";
    
    const { data: { user } } = await supabase.auth.getUser();
    
    let orgEvents = [];
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organisation")
        .eq("id", user.id)
        .maybeSingle();
      
      const org = profile?.organisation;
      if (org) {
        const { data: eventsData } = await supabase
          .from("events")
          .select("*")
          .eq("organisation", org);
        orgEvents = eventsData.map(ev => ({
          day: new Date(ev.date).getDate(),
          month: new Date(ev.date).getMonth(),
          year: new Date(ev.date).getFullYear(),
          name: ev.title
        }));
      }
    }
    
    for (let i = 0; i < firstDay; i++) daysContainer.innerHTML += `<div></div>`;
    
    for (let d = 1; d <= lastDate; d++) {
      const dayDiv = document.createElement("div");
      dayDiv.textContent = d;
      dayDiv.classList.add("day");
      
      const hasEvent = globalEvents.some(e => e.day === d && e.month === month) ||
                       orgEvents.some(e => e.day === d && e.month === month);
      if (hasEvent) dayDiv.style.backgroundColor = "#ffd";
      
      dayDiv.onclick = () => addEvent(d);
      daysContainer.appendChild(dayDiv);
    }
    
    displayEvents(globalEvents, orgEvents);
  }
  
  async function addEvent(day) {
    const eventName = prompt(`Enter event for ${day} ${monthYear.textContent}:`);
    if (!eventName) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("You must be logged in to add events");
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation")
      .eq("id", user.id)
      .maybeSingle();
    const org = profile?.organisation;
    if (!org) return alert("Join an organisation first!");
    
    const dateStr = new Date(year, month, day).toISOString();
    const { error } = await supabase
      .from("events")
      .insert([{ user_id: user.id, organisation: org, title: eventName, date: dateStr }]);
    if (error) return console.error(error);
    
    const { error: pointsError } = await supabase.rpc("increment_points", {
      uid: user.id,
      inc: 15
    });
    if (pointsError) console.error("Failed to add points:", pointsError);
    
    setStatus("Event made! +15 points");
    loadCalendar();
  }
  
  function displayEvents(globalEvents, orgEvents) {
    eventList.innerHTML = "";
    
    const monthEvents = [];
    
    globalEvents.forEach(e => {
      if (e.month === month) monthEvents.push({ day: e.day, name: e.name });
    });
    orgEvents.forEach(e => {
      if (e.month === month && e.year === year) monthEvents.push({ day: e.day, name: e.name });
    });
    
    monthEvents.sort((a, b) => a.day - b.day);
    
    monthEvents.forEach(e => {
      const formattedDate = formatDate(e.day, month, year);
      const div = document.createElement("div");
      div.classList.add("event-item");
      div.textContent = `${formattedDate}: ${e.name}`;
      eventList.appendChild(div);
    });
  }
  
  function prevMonth() {
    month--;
    if (month < 0) { month = 11; year--; }
    loadCalendar();
  }
  
  function nextMonth() {
    month++;
    if (month > 11) { month = 0; year++; }
    loadCalendar();
  }
  
  window.prevMonth = prevMonth;
  window.nextMonth = nextMonth;
  
  loadCalendar();
  await loadUserSidebar();
});



// RANKINGS

document.addEventListener("DOMContentLoaded", () => {
  const supabase = window.supabase;
  
  function notify(msg, isError = false) {
    if (typeof setStatus === "function") {
      setStatus(msg, isError);
    } else {
      console.log(msg);
    }
  }
  
  async function promptOrganisation(user) {
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation, points")
      .eq("id", user.id)
      .maybeSingle();
    let org = profile?.organisation;
    let points = profile?.points ?? 0;
    org = prompt("Enter your organisation:");
    if (org) {
      const { error } = await supabase
        .from("profiles")
        .update({ organisation: org, points: points + 50 })
        .eq("id", user.id);
      if (!error) notify(`Joined "${org}"! +50 points`);
      else notify("Failed to join organisation.", true);
    }
    return org;
  }
  
  async function loadRankings() {
    const rankingsPage = document.getElementById("rankings");
    if (!rankingsPage.classList.contains("active")) return;
    const titleDiv = document.getElementById("rankings-title");
    const globalDiv = document.getElementById("rankings-global");
    const orgDiv = document.getElementById("rankings-org");
    
    if (!rankingsPage.classList.contains("active")) return;
    
    titleDiv.innerHTML = "";
    globalDiv.innerHTML = "";
    orgDiv.innerHTML = "";
    const { data: globalData, error: globalErr } = await supabase
      .from("profiles")
      .select("display_name, points, organisation")
      .order("points", { ascending: false });
    if (!globalErr && globalData) {
      titleDiv.innerHTML = "<h2>Rankings</h2> <p>Earn points and climb the leaderboard!(Joining an organisation earns you 50 points.)</p>"
      globalDiv.innerHTML = "<h3>Global Rankings</h3>" +
        globalData.map((row, i) =>
        `<div style="display:flex;justify-content:space-between;padding:0 5%;">
            <span>
              ${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <span>${row.display_name}</span>
            <span>${row.points}</span>
         </div>`).join("");

    }
      const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      orgDiv.innerHTML = "<h3>Organisation Rankings</h3><p style='color:gray;'>Log in to see your organisation rankings</p>";
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("organisation")
      .eq("id", user.id)
      .maybeSingle();
    const org = profile?.organisation;
    if (!org) {
      orgDiv.innerHTML = `<h3>Organisation Rankings</h3><p style='color:gray; cursor:pointer;' id="joinOrgPrompt">Click here to join an organisation</p>`;
      document.getElementById("joinOrgPrompt").addEventListener("click", async () => {
        const newOrg = await promptOrganisation(user);
        if (newOrg) loadRankings();
      });
      return;
    }
    const { data: orgData, error: orgErr } = await supabase
      .from("profiles")
      .select("display_name, points")
      .eq("organisation", org)
      .order("points", { ascending: false });
    if (!orgErr && orgData) {
      orgDiv.innerHTML = `<h3>${org} Rankings</h3>` +
        orgData.map((row, i) =>
          `<div style="display:flex;justify-content:space-between;padding:0 5%;">
              <span>${i + 1}</span>
              <span>${row.display_name}</span>
              <span>${row.points}</span>
          </div>`).join("");
    }
  }
  
  const navButtons = document.querySelectorAll('nav button');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        if (p.id === 'rankings') {
          document.getElementById('rankings-title').innerHTML = '';
          document.getElementById('rankings-global').innerHTML = '';
          document.getElementById('rankings-org').innerHTML = '';
        }
      });
      const page = document.getElementById(btn.dataset.page);
      page.classList.add('active');
      if (btn.dataset.page === 'rankings') loadRankings();
    });
  });
  
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'rankings') loadRankings();
});



// PHOTO

const setStatus = (msg, isError = false) => {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = msg;
    el.className = isError ? "error" : "info";
  }
};

const uploadPhotoBtn = document.getElementById("uploadPhoto");
const photoFileInput = document.getElementById("photoFile");
const photoLabelInput = document.getElementById("photoLabel");

async function loadUserSidebar() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user) return;
  
  const profileResp = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  
  const profile = profileResp.data;
  if (!profile) return;
  
  const profileContainer = document.getElementById("your-profile");
  if (!profileContainer) return;
  
  profileContainer.innerHTML = `
    <div class="profile-field"><strong>Email:</strong> ${profile.email}</div>
    <div class="profile-field"><strong>Display:</strong> ${profile.display_name}</div>
    <div class="profile-field"><strong>Points:</strong> ${profile.points || 0}</div>
    <div id="my-photos">
      <h3>Your Photos</h3>
      <div id="photosContainer" style="display:flex;flex-wrap:wrap;gap:5px;"></div>
    </div>
  `;
  
  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  
  const photosContainer = document.getElementById("photosContainer");
  if (!photosContainer) return;
  
  if (photosError) {
    console.error("Error fetching photos:", photosError);
    photosContainer.innerHTML = "<p>Failed to load photos.</p>";
    return;
  }
  
  if (!photos || photos.length === 0) {
    photosContainer.innerHTML = "<p>No photos uploaded yet.</p>";
    return;
  }
  
  photosContainer.innerHTML = "";
  
  photos.forEach(p => {
    const wrapper = document.createElement("div");
    wrapper.style.width = "60px";
    wrapper.style.textAlign = "center";
    
    const img = document.createElement("img");
    img.src = p.url;
    img.alt = p.label;
    img.style.width = "100%";
    img.style.borderRadius = "5px";
    
    const label = document.createElement("div");
    label.textContent = p.label;
    label.style.fontSize = "10px";
    
    wrapper.appendChild(img);
    wrapper.appendChild(label);
    photosContainer.appendChild(wrapper);
  });
}

if (uploadPhotoBtn) {
  uploadPhotoBtn.addEventListener("click", async () => {
    const file = photoFileInput.files[0];
    const label = photoLabelInput.value.trim();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !file || !label) {
      setStatus("Select a file and enter a label.", true);
      return;
    }
    
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from("user-photos")
      .upload(fileName, file);
    
    if (uploadError) {
      setStatus("Upload failed.", true);
      console.error(uploadError);
      return;
    }
    
    const { data: { publicUrl }, error: urlError } = supabase.storage
      .from("user-photos")
      .getPublicUrl(fileName);
    
    if (urlError) {
      setStatus("Failed to get public URL.", true);
      console.error(urlError);
      return;
    }
    
    const { error: insertError } = await supabase
      .from("photos")
      .insert([{ user_id: user.id, label, url: publicUrl }]);
    
    if (insertError) {
      setStatus("Failed to save photo metadata.", true);
      console.error(insertError);
      return;
    }
    
    const { error: pointsError } = await supabase.rpc("increment_points", {
      uid: user.id,
      inc: 20
    });
    
    if (pointsError) console.error("Failed to add points:", pointsError);
    
    setStatus("Photo uploaded! +20 points");
    photoFileInput.value = "";
    photoLabelInput.value = "";
    
    await loadUserSidebar();
  });
}

document.addEventListener("DOMContentLoaded", loadUserSidebar);