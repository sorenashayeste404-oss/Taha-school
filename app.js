import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "../firebase-config.js";

const DAYS = [
  { id: "saturday", label: "شنبه" },
  { id: "sunday", label: "یکشنبه" },
  { id: "monday", label: "دوشنبه" },
  { id: "tuesday", label: "سه‌شنبه" },
  { id: "wednesday", label: "چهارشنبه" },
  { id: "thursday", label: "پنجشنبه" }
];

const MAJORS = {
  experimental: "دهم تجربی",
  math: "دهم ریاضی",
  humanities: "دهم انسانی"
};

const BRANCHES = {
  "1": "شعبه ۱",
  "2": "شعبه ۲"
};

let firebaseReady = false;
let app, auth, db;
let currentUser = null;
let selectedMajor = null;
let selectedBranch = null;
let adminClasses = [];
let adminTasks = [];

const $ = (id) => document.getElementById(id);

function showToast(message, type = "info") {
  const el = $("toast");
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.className = "toast", 3500);
}

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function populateSelects() {
  const majorOptions = Object.entries(MAJORS)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  $("classMajor").innerHTML = majorOptions;
  $("taskMajor").innerHTML = majorOptions;

  const dayOptions = DAYS.map(d => `<option value="${d.id}">${d.label}</option>`).join("");
  $("classDay").innerHTML = dayOptions;
  $("taskDay").innerHTML = dayOptions;
}

function getDayLabel(id) {
  return DAYS.find(d => d.id === id)?.label || id;
}

function sortClasses(a, b) {
  const dayIndex = DAYS.findIndex(d => d.id === a.day) - DAYS.findIndex(d => d.id === b.day);
  if (dayIndex !== 0) return dayIndex;
  return String(a.time || "").localeCompare(String(b.time || ""), "fa");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initFirebase() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.projectId || firebaseConfig.projectId === "YOUR_PROJECT_ID") {
    showToast("ابتدا firebase-config.js را با اطلاعات پروژه Firebase خودتان کامل کنید.", "error");
    return false;
  }
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseReady = true;
    return true;
  } catch (error) {
    console.error(error);
    showToast("اتصال Firebase برقرار نشد. تنظیمات Firebase را بررسی کنید.", "error");
    return false;
  }
}

async function isAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists() && snap.data().active === true && snap.data().role === "admin";
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function loadStudentSchedule() {
  if (!firebaseReady || !selectedMajor || !selectedBranch) return;
  $("studentLoading").classList.remove("hidden");
  $("studentEmpty").classList.add("hidden");
  $("scheduleGrid").innerHTML = "";

  try {
    const classQuery = query(
      collection(db, "classes"),
      where("major", "==", selectedMajor),
      where("branch", "==", selectedBranch)
    );
    const taskQuery = query(
      collection(db, "dailyTasks"),
      where("major", "==", selectedMajor),
      where("branch", "==", selectedBranch)
    );

    const [classSnap, taskSnap] = await Promise.all([getDocs(classQuery), getDocs(taskQuery)]);
    const classes = classSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortClasses);
    const tasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderStudentSchedule(classes, tasks);
  } catch (error) {
    console.error(error);
    showToast("دریافت برنامه با خطا روبه‌رو شد. Firestore Rules و اتصال Firebase را بررسی کنید.", "error");
  } finally {
    $("studentLoading").classList.add("hidden");
  }
}

function renderStudentSchedule(classes, tasks) {
  const grid = $("scheduleGrid");
  grid.innerHTML = "";

  DAYS.forEach(day => {
    const dayClasses = classes.filter(c => c.day === day.id).sort((a,b) => String(a.time || "").localeCompare(String(b.time || ""), "fa"));
    const dayTasks = tasks.filter(t => t.day === day.id);

    const card = document.createElement("article");
    card.className = "day-card";
    card.innerHTML = `
      <div class="day-header">
        <div><span class="day-dot"></span><h3>${day.label}</h3></div>
        <span class="count-badge">${dayClasses.length} کلاس</span>
      </div>
      <div class="class-list">
        ${dayClasses.length ? dayClasses.map(c => `
          <div class="class-item">
            <div class="time">${escapeHtml(c.time)}</div>
            <div class="subject">${escapeHtml(c.subject)}</div>
          </div>`).join("") : `<div class="no-class">کلاسی ثبت نشده</div>`}
      </div>
      <div class="tasks-block">
        <div class="tasks-title"><span>✓</span> کارهای روزانه</div>
        ${dayTasks.length ? dayTasks.map(t => `
          <div class="task-item">
            <strong>${escapeHtml(t.title)}</strong>
            ${t.description ? `<p>${escapeHtml(t.description)}</p>` : ""}
          </div>`).join("") : `<div class="no-task">کاری برای امروز ثبت نشده</div>`}
      </div>
    `;
    grid.appendChild(card);
  });

  $("studentEmpty").classList.toggle("hidden", classes.length > 0 || tasks.length > 0);
}

async function handleLogin(event) {
  event.preventDefault();
  if (!firebaseReady) return;
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "در حال ورود...";
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const allowed = await isAdmin(credential.user.uid);
    if (!allowed) {
      await signOut(auth);
      showToast("این حساب مجوز مدیر ندارد.", "error");
      return;
    }
    showToast("ورود مدیر با موفقیت انجام شد.", "success");
    showView("adminPanel");
    await loadAdminData();
  } catch (error) {
    console.error(error);
    const messages = {
      "auth/invalid-credential": "ایمیل یا رمز عبور نادرست است.",
      "auth/user-not-found": "حساب کاربری پیدا نشد.",
      "auth/wrong-password": "رمز عبور نادرست است.",
      "auth/too-many-requests": "تلاش‌های ناموفق زیاد بوده؛ کمی بعد دوباره امتحان کنید."
    };
    showToast(messages[error.code] || "ورود انجام نشد.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "ورود به پنل";
  }
}

async function loadAdminData() {
  if (!currentUser || !(await isAdmin(currentUser.uid))) {
    showView("adminLogin");
    return;
  }

  $("adminUserLabel").textContent = currentUser.email || "";
  try {
    const [classSnap, taskSnap] = await Promise.all([
      getDocs(query(collection(db, "classes"), orderBy("day"), orderBy("time"))),
      getDocs(query(collection(db, "dailyTasks"), orderBy("day"), orderBy("title")))
    ]);

    adminClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    adminTasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminTables();
  } catch (error) {
    console.error(error);
    showToast("دریافت اطلاعات پنل مدیر ناموفق بود. ممکن است Index موردنیاز Firestore ساخته نشده باشد.", "error");
    // Fallback without orderBy so the panel remains usable.
    try {
      const [classSnap, taskSnap] = await Promise.all([
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "dailyTasks"))
      ]);
      adminClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortClasses);
      adminTasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAdminTables();
    } catch (fallbackError) {
      console.error(fallbackError);
      showToast("خواندن اطلاعات Firestore ممکن نشد.", "error");
    }
  }
}

function renderAdminTables() {
  $("classCount").textContent = adminClasses.length.toLocaleString("fa-IR");
  $("taskCount").textContent = adminTasks.length.toLocaleString("fa-IR");
  $("totalCount").textContent = (adminClasses.length + adminTasks.length).toLocaleString("fa-IR");

  const classBody = $("classesTableBody");
  const taskBody = $("tasksTableBody");
  classBody.innerHTML = "";
  taskBody.innerHTML = "";

  [...adminClasses].sort(sortClasses).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(MAJORS[item.major] || item.major)}</td>
      <td>${escapeHtml(BRANCHES[item.branch] || item.branch)}</td>
      <td>${escapeHtml(getDayLabel(item.day))}</td>
      <td>${escapeHtml(item.time)}</td>
      <td><strong>${escapeHtml(item.subject)}</strong></td>
      <td class="actions"><button class="edit-btn" data-action="edit-class" data-id="${item.id}">ویرایش</button><button class="delete-btn" data-action="delete-class" data-id="${item.id}">حذف</button></td>
    `;
    classBody.appendChild(tr);
  });

  [...adminTasks].sort((a,b) => DAYS.findIndex(d => d.id === a.day) - DAYS.findIndex(d => d.id === b.day)).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(MAJORS[item.major] || item.major)}</td>
      <td>${escapeHtml(BRANCHES[item.branch] || item.branch)}</td>
      <td>${escapeHtml(getDayLabel(item.day))}</td>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td>${escapeHtml(item.description || "—")}</td>
      <td class="actions"><button class="edit-btn" data-action="edit-task" data-id="${item.id}">ویرایش</button><button class="delete-btn" data-action="delete-task" data-id="${item.id}">حذف</button></td>
    `;
    taskBody.appendChild(tr);
  });

  $("classesTableEmpty").classList.toggle("hidden", adminClasses.length > 0);
  $("tasksTableEmpty").classList.toggle("hidden", adminTasks.length > 0);
}

async function saveClass(event) {
  event.preventDefault();
  if (!currentUser || !(await isAdmin(currentUser.uid))) return showToast("دسترسی مدیر تأیید نشد.", "error");

  const id = $("classId").value;
  const data = {
    major: $("classMajor").value,
    branch: $("classBranch").value,
    day: $("classDay").value,
    time: $("classTime").value.trim(),
    subject: $("classSubject").value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "classes", id), data);
      showToast("کلاس ویرایش شد.", "success");
    } else {
      await addDoc(collection(db, "classes"), { ...data, createdAt: serverTimestamp(), createdBy: currentUser.uid });
      showToast("کلاس ثبت شد.", "success");
    }
    resetClassForm();
    await loadAdminData();
  } catch (error) {
    console.error(error);
    showToast("ذخیره کلاس انجام نشد.", "error");
  }
}

async function saveTask(event) {
  event.preventDefault();
  if (!currentUser || !(await isAdmin(currentUser.uid))) return showToast("دسترسی مدیر تأیید نشد.", "error");

  const id = $("taskId").value;
  const data = {
    major: $("taskMajor").value,
    branch: $("taskBranch").value,
    day: $("taskDay").value,
    title: $("taskTitle").value.trim(),
    description: $("taskDescription").value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "dailyTasks", id), data);
      showToast("کار روزانه ویرایش شد.", "success");
    } else {
      await addDoc(collection(db, "dailyTasks"), { ...data, createdAt: serverTimestamp(), createdBy: currentUser.uid });
      showToast("کار روزانه ثبت شد.", "success");
    }
    resetTaskForm();
    await loadAdminData();
  } catch (error) {
    console.error(error);
    showToast("ذخیره کار روزانه انجام نشد.", "error");
  }
}

function resetClassForm() {
  $("classForm").reset();
  $("classId").value = "";
  $("classFormTitle").textContent = "ثبت کلاس";
  $("classSubmitBtn").textContent = "ثبت کلاس";
  $("classCancelBtn").classList.add("hidden");
  $("classMajor").value = "experimental";
  $("classBranch").value = "1";
  $("classDay").value = "saturday";
}

function resetTaskForm() {
  $("taskForm").reset();
  $("taskId").value = "";
  $("taskFormTitle").textContent = "ثبت کار روزانه";
  $("taskSubmitBtn").textContent = "ثبت کار روزانه";
  $("taskCancelBtn").classList.add("hidden");
  $("taskMajor").value = "experimental";
  $("taskBranch").value = "1";
  $("taskDay").value = "saturday";
}

function editClass(id) {
  const item = adminClasses.find(x => x.id === id);
  if (!item) return;
  $("classId").value = item.id;
  $("classMajor").value = item.major;
  $("classBranch").value = item.branch;
  $("classDay").value = item.day;
  $("classTime").value = item.time || "";
  $("classSubject").value = item.subject || "";
  $("classFormTitle").textContent = "ویرایش کلاس";
  $("classSubmitBtn").textContent = "ذخیره تغییرات";
  $("classCancelBtn").classList.remove("hidden");
  $("classForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function editTask(id) {
  const item = adminTasks.find(x => x.id === id);
  if (!item) return;
  $("taskId").value = item.id;
  $("taskMajor").value = item.major;
  $("taskBranch").value = item.branch;
  $("taskDay").value = item.day;
  $("taskTitle").value = item.title || "";
  $("taskDescription").value = item.description || "";
  $("taskFormTitle").textContent = "ویرایش کار روزانه";
  $("taskSubmitBtn").textContent = "ذخیره تغییرات";
  $("taskCancelBtn").classList.remove("hidden");
  $("taskForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteClass(id) {
  if (!confirm("این کلاس حذف شود؟")) return;
  try {
    await deleteDoc(doc(db, "classes", id));
    showToast("کلاس حذف شد.", "success");
    await loadAdminData();
  } catch (error) {
    console.error(error);
    showToast("حذف کلاس انجام نشد.", "error");
  }
}

async function deleteTask(id) {
  if (!confirm("این کار روزانه حذف شود؟")) return;
  try {
    await deleteDoc(doc(db, "dailyTasks", id));
    showToast("کار روزانه حذف شد.", "success");
    await loadAdminData();
  } catch (error) {
    console.error(error);
    showToast("حذف کار روزانه انجام نشد.", "error");
  }
}

function chooseMajor(major) {
  selectedMajor = major;
  document.querySelectorAll("#majorChoices .choice-card").forEach(btn => btn.classList.toggle("selected", btn.dataset.major === major));
  $("branchStep").classList.remove("hidden");
  $("branchStep").scrollIntoView({ behavior: "smooth", block: "center" });
}

function chooseBranch(branch) {
  if (!selectedMajor) return;
  selectedBranch = branch;
  document.querySelectorAll("#branchChoices .choice-card").forEach(btn => btn.classList.toggle("selected", btn.dataset.branch === branch));
  $("scheduleTitle").textContent = `برنامه ${MAJORS[selectedMajor]}`;
  $("scheduleSubtitle").textContent = `${BRANCHES[selectedBranch]} · شنبه تا پنجشنبه`;
  showView("studentSchedule");
  loadStudentSchedule();
}

function wireEvents() {
  $("majorChoices").addEventListener("click", e => {
    const btn = e.target.closest("[data-major]");
    if (btn) chooseMajor(btn.dataset.major);
  });
  $("branchChoices").addEventListener("click", e => {
    const btn = e.target.closest("[data-branch]");
    if (btn) chooseBranch(btn.dataset.branch);
  });

  $("backToSelection").addEventListener("click", () => showView("studentSelection"));
  $("refreshStudent").addEventListener("click", loadStudentSchedule);

  $("adminNavBtn").addEventListener("click", async () => {
    if (currentUser && await isAdmin(currentUser.uid)) {
      showView("adminPanel");
      loadAdminData();
    } else {
      showView("adminLogin");
    }
  });
  $("backHomeFromLogin").addEventListener("click", () => showView("studentSelection"));
  $("homeBtn").addEventListener("click", () => showView("studentSelection"));
  $("homeBtn").addEventListener("keydown", e => { if (e.key === "Enter") showView("studentSelection"); });

  $("loginForm").addEventListener("submit", handleLogin);
  $("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    showView("studentSelection");
    showToast("از حساب مدیر خارج شدید.", "success");
  });

  $("classForm").addEventListener("submit", saveClass);
  $("taskForm").addEventListener("submit", saveTask);
  $("classCancelBtn").addEventListener("click", resetClassForm);
  $("taskCancelBtn").addEventListener("click", resetTaskForm);
  $("reloadAdminData").addEventListener("click", loadAdminData);

  $("classesTableBody").addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit-class") editClass(id);
    if (btn.dataset.action === "delete-class") deleteClass(id);
  });
  $("tasksTableBody").addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit-task") editTask(id);
    if (btn.dataset.action === "delete-task") deleteTask(id);
  });
}

populateSelects();
resetClassForm();
resetTaskForm();
wireEvents();

if (initFirebase()) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      const allowed = await isAdmin(user.uid);
      if (allowed) {
        $("adminUserLabel").textContent = user.email || "";
      }
    }
  });
}
