import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let vocabData = [];
let curId = null;
let qPool = [];
let qIdx = 0;
let currentUid = null;

window.speak = (text) => {
    if(!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
};

window.speakCurrentQ = () => {
    const type = document.getElementById('quizType').value;
    const q = qPool[qIdx];
    if (type === 'EtoK') {
        window.speak(q.eng);
    }
};

onAuthStateChanged(auth, (user) => {
    const userEmailSpan = document.getElementById('userEmail');
    if (user) {
        currentUid = user.uid;
        userEmailSpan.innerText = user.email;
        userEmailSpan.title = user.email;
        document.getElementById('scrLogin').classList.remove('active');
        document.getElementById('mainContainer').style.opacity = '1';
        loadData(user.uid);
        nav('scrHome');
    } else {
        currentUid = null;
        userEmailSpan.innerText = '';
        userEmailSpan.title = '';
        document.getElementById('scrLogin').classList.add('active');
        document.getElementById('mainContainer').style.opacity = '0';
    }
});

function loadData(uid) {
    onValue(ref(db, `users/${uid}/vocabData`), (snapshot) => {
        const data = snapshot.val();
        vocabData = data ? Object.values(data) : [];
        updateTotalBadge();
        renderHome();
        if (curId) {
            const b = vocabData.find(x => x.id === curId);
            if(b) document.getElementById('detailTitle').innerText = b.title;
            renderWords();
        }
        if(document.getElementById('scrQuizSetup').classList.contains('active')) renderSetup();
    });
}

document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('loginEmail').value;
    const pw = document.getElementById('loginPw').value;
    try {
        await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
        document.getElementById('loginError').innerText = "로그인 정보가 틀렸습니다.";
    }
};

// 로그인/회원가입 폼 전환 및 회원가입 로직
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

const showLoginForm = () => {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginError.innerText = ''; // Clear previous errors
    registerError.innerText = ''; // Clear previous errors
};

const showRegisterForm = () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginError.innerText = ''; // Clear previous errors
    registerError.innerText = ''; // Clear previous errors
};

document.getElementById('showRegisterForm').onclick = showRegisterForm;
document.getElementById('showLoginForm').onclick = showLoginForm;

document.getElementById('btnRegister').onclick = async () => {
    const email = document.getElementById('registerEmail').value;
    const pw = document.getElementById('registerPw').value;
    const pwConfirm = document.getElementById('registerPwConfirm').value;

    registerError.innerText = ''; // Clear previous errors

    if (pw !== pwConfirm) {
        registerError.innerText = "비밀번호가 일치하지 않습니다.";
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, pw);
        // 회원가입 성공 시 onAuthStateChanged가 처리하므로 추가적인 UI 처리는 필요 없음
    } catch (e) {
        let errorMessage = "회원가입 중 오류가 발생했습니다.";
        if (e.code === 'auth/email-already-in-use') {
            errorMessage = "이미 사용 중인 이메일입니다.";
        } else if (e.code === 'auth/invalid-email') {
            errorMessage = "유효하지 않은 이메일 형식입니다.";
        } else if (e.code === 'auth/weak-password') {
            errorMessage = "비밀번호는 6자 이상이어야 합니다.";
        }
        registerError.innerText = errorMessage;
    }
};

window.logout = () => signOut(auth);

window.nav = (id) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const isQuizSetup = (id === 'scrQuizSetup');
    document.getElementById('navHomeIcon').className = isQuizSetup ? "w-12 h-8 rounded-2xl flex items-center justify-center" : "w-12 h-8 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-600";
    document.getElementById('navQuizIcon').className = isQuizSetup ? "w-12 h-8 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-600" : "w-12 h-8 rounded-2xl flex items-center justify-center";
    if(id === 'scrQuizSetup') renderSetup();
    window.scrollTo(0,0);
};

function updateTotalBadge() {
    const total = vocabData.reduce((acc, b) => acc + (b.words ? Object.values(b.words).length : 0), 0);
    document.getElementById('totalBadge').innerText = total;
}

window.createBook = () => {
    const titleInput = document.getElementById('newBookTitle');
    const title = titleInput.value.trim();
    if(!title || !currentUid) return;
    const newRef = push(ref(db, `users/${currentUid}/vocabData`));
    set(newRef, { id: newRef.key, title, words: {} });
    titleInput.value = ""; nav('scrHome');
};

window.editBookTitle = () => {
    if(!curId || !currentUid) return;
    const b = vocabData.find(x => x.id === curId);
    if(b.title === '오답노트 ⭐️') return alert('이 단어장은 이름을 바꿀 수 없어!');

    const newTitle = prompt('새로운 이름을 입력해줘:', b.title);
    if(newTitle && newTitle.trim() !== "") {
        set(ref(db, `users/${currentUid}/vocabData/${curId}/title`), newTitle.trim());
    }
}

function renderHome() {
    const list = document.getElementById('bookList');
    if(vocabData.length === 0) { list.innerHTML = `<div class="py-20 text-center text-slate-300 font-bold">단어장을 만들어보세요.</div>`; return; }
    
    list.innerHTML = vocabData.map(b => {
        const isNote = b.title === '오답노트 ⭐️';
        const bgClass = isNote ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-50';
        return `
        <div class="${bgClass} p-6 rounded-[2.5rem] flex justify-between items-center border shadow-sm active:scale-95 transition cursor-pointer" onclick="openBook('${b.id}')">
            <div class="text-left">
                <h3 class="font-bold text-slate-800 text-lg">${b.title}</h3>
                <p class="text-xs text-indigo-500 font-semibold mt-1">${b.words ? Object.values(b.words).length : 0} Words</p>
            </div>
            <button onclick="event.stopPropagation(); window.delBook('${b.id}')" class="text-slate-200 hover:text-red-400 p-2 text-xl">✕</button>
        </div>
    `}).join('');
}

window.openBook = (id) => {
    curId = id; const b = vocabData.find(x => x.id === id);
    if(b) { 
        document.getElementById('detailTitle').innerText = b.title;
        
        const inputSection = document.getElementById('inputSection');
        const editBtn = document.getElementById('btnEditTitle');
        
        if (b.title === '오답노트 ⭐️') {
            inputSection.style.display = 'none';
            editBtn.style.display = 'none';
        } else {
            inputSection.style.display = 'block';
            editBtn.style.display = 'block';
        }

        renderWords();
        nav('scrDetail');
    }
};

window.toggleInputMode = (m) => {
    const isS = m === 'single';
    document.getElementById('modeSingle').classList.toggle('hidden', !isS);
    document.getElementById('modeBulk').classList.toggle('hidden', isS);
    document.getElementById('btnTabSingle').className = isS ? "flex-1 py-2.5 rounded-xl bg-white text-indigo-600 text-xs font-bold shadow-sm" : "flex-1 py-2.5 rounded-xl text-white/40 text-xs font-bold";
    document.getElementById('btnTabBulk').className = !isS ? "flex-1 py-2.5 rounded-xl bg-white text-indigo-600 text-xs font-bold shadow-sm" : "flex-1 py-2.5 rounded-xl text-white/40 text-xs font-bold";
};

window.addWord = () => {
    const e = document.getElementById('inEng'), k = document.getElementById('inKor');
    if(!e.value.trim() || !k.value.trim()) return;
    push(ref(db, `users/${currentUid}/vocabData/${curId}/words`), { eng: e.value.trim(), kor: k.value.trim(), time: Date.now() });
    e.value = ""; k.value = "";
    setTimeout(() => e.focus(), 100);
};

window.addBulkWords = () => {
    const area = document.getElementById('bulkInput');
    if(!area.value.trim()) return;
    area.value.trim().split('\n').forEach(line => {
        const p = line.split(/[:\-\t]/);
        if(p.length >= 2) push(ref(db, `users/${currentUid}/vocabData/${curId}/words`), { eng: p[0].trim(), kor: p[1].trim(), time: Date.now() });
    });
    area.value = "";
};

window.renderWords = () => {
    const table = document.getElementById('wordTable');
    const b = vocabData.find(x => x.id === curId);
    if(!b || !b.words) { table.innerHTML = ""; return; }
    
    table.innerHTML = Object.entries(b.words).reverse().map(([key, w]) => `
        <div class="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-transparent">
            <div class="flex items-center gap-3">
                <button onclick="speak('${w.eng.replace(/'/g, "\\'")}')" class="w-10 h-10 rounded-full bg-white text-indigo-500 flex items-center justify-center shadow-sm btn-effect">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                </button>
                <div>
                    <p class="text-sm font-bold text-slate-800">${w.eng}</p>
                    <p class="text-xs text-slate-400 mt-1">${w.kor}</p>
                </div>
            </div>
            <button onclick="window.delWord('${key}')" class="text-slate-300 px-2">✕</button>
        </div>
    `).join('');
};

window.renderSetup = () => {
    const rangeList = document.getElementById('quizRangeList');
    if(!vocabData || vocabData.length === 0) { 
        rangeList.innerHTML = '<p class="text-sm text-center text-slate-400 py-10 font-bold italic">단어장이 없습니다.</p>';
        return;
    }
    rangeList.innerHTML = vocabData.map(b => `
        <label class="quiz-item flex items-center gap-4 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98]">
            <input type="checkbox" name="quizBooks" value="${b.id}" checked class="w-6 h-6 accent-indigo-600 rounded-lg cursor-pointer">
            <div class="flex-1">
                <span class="font-bold text-slate-800 text-lg transition-colors">${b.title}</span>
                <span class="text-[10px] text-indigo-600 ml-2 font-black uppercase tracking-widest">${b.words ? Object.values(b.words).length : 0} Vocabs</span>
            </div>
        </label>
    `).join('');
}

window.startQuiz = () => {
    const checked = document.querySelectorAll('input[name="quizBooks"]:checked');
    const count = parseInt(document.getElementById('quizCount').value);
    let all = [];
    checked.forEach(cb => {
        const b = vocabData.find(x => x.id == cb.value);
        if(b && b.words) all.push(...Object.values(b.words));
    });
    if(all.length === 0) return alert('단어장을 선택해줘!');
    qPool = all.sort(() => Math.random() - 0.5);
    if(count > 0 && count < qPool.length) qPool = qPool.slice(0, count);
    qIdx = 0; nav('scrPlay'); loadQ();
};

function loadQ() {
    const q = qPool[qIdx];
    const type = document.getElementById('quizType').value;
    document.getElementById('qStatus').innerText = `${qIdx + 1} / ${qPool.length}`;
    document.getElementById('qText').innerText = type === 'EtoK' ? q.eng : q.kor;
    
    const speakBtn = document.getElementById('qSpeakBtn');
    if (type === 'EtoK') {
        speakBtn.style.display = 'block';
    } else {
        speakBtn.style.display = 'none';
    }

    document.getElementById('qInput').value = "";
    setTimeout(() => document.getElementById('qInput').focus(), 150);
}

async function saveToWrongNote(wordObj) {
    if (!currentUid) return;
    
    let noteBook = vocabData.find(b => b.title === '오답노트 ⭐️');
    let noteBookId;

    if (noteBook) {
        noteBookId = noteBook.id;
        if (noteBook.words) {
            const exists = Object.values(noteBook.words).some(w => w.eng === wordObj.eng);
            if (exists) return;
        }
    } else {
        const newRef = push(ref(db, `users/${currentUid}/vocabData`));
        noteBookId = newRef.key;
        await set(newRef, { id: noteBookId, title: '오답노트 ⭐️', words: {} });
    }

    push(ref(db, `users/${currentUid}/vocabData/${noteBookId}/words`), {
        eng: wordObj.eng,
        kor: wordObj.kor,
        time: Date.now()
    });
}

window.checkAns = () => {
    const inp = document.getElementById('qInput');
    const ans = inp.value.trim().toLowerCase().replace(/\s+/g, ' ');
    const type = document.getElementById('quizType').value;
    const currentWord = qPool[qIdx];
    const correct = type === 'EtoK' ? currentWord.kor : currentWord.eng;
    
    const answers = correct.toLowerCase().split(/[,;/]/).map(s => s.trim().replace(/\s+/g, ' '));

    if (answers.includes(ans)) {
        qIdx++;
        if(qIdx < qPool.length) loadQ();
        else { alert('🏆 최고야 Ella! 다 풀었어!'); nav('scrHome'); }
    } else {
        alert(`아쉬워! 정답: [${correct}]`);
        saveToWrongNote(currentWord);
        setTimeout(() => inp.focus(), 150);
    }
};

window.delBook = (id) => { if(confirm('단어장을 지울까?')) remove(ref(db, `users/${currentUid}/vocabData/${id}`)); };
window.delWord = (key) => { if(confirm('단어를 지울까?')) remove(ref(db, `users/${currentUid}/vocabData/${curId}/words/${key}`)); };

const handleEnter = (e, callback) => {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
        e.preventDefault();
        callback();
    }
};

document.getElementById('inKor').addEventListener('keydown', (e) => handleEnter(e, window.addWord));
document.getElementById('qInput').addEventListener('keydown', (e) => handleEnter(e, window.checkAns));
