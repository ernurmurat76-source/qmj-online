const form = document.querySelector('#qmjForm');
const emptyPreview = document.querySelector('#emptyPreview');
const resultPreview = document.querySelector('#resultPreview');
const toast = document.querySelector('#toast');
const authDialog = document.querySelector('#authDialog');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const grade = document.querySelector('#grade').value;
  const subject = document.querySelector('#subject').value;
  const topic = document.querySelector('#topic').value.trim();
  const objective = document.querySelector('#objective').value.trim();
  if (!grade) {
    showToast('Сыныпты таңдаңыз');
    return;
  }
  document.querySelector('#resultSubject').textContent = `${subject} · ${grade} · ${document.querySelector('#duration').value}`;
  document.querySelector('#resultTopic').textContent = topic;
  document.querySelector('#resultObjective').textContent = objective;
  emptyPreview.classList.add('hidden');
  resultPreview.classList.remove('hidden');
  if (window.innerWidth < 900) document.querySelector('#previewCard').scrollIntoView({behavior: 'smooth'});
  showToast('Демо ҚМЖ сәтті құрылды');
});

document.querySelector('#savePlan').addEventListener('click', () => {
  const plan = {
    subject: document.querySelector('#subject').value,
    grade: document.querySelector('#grade').value,
    topic: document.querySelector('#topic').value,
    objective: document.querySelector('#objective').value,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('qmj-demo-plan', JSON.stringify(plan));
  showToast('ҚМЖ браузерде сақталды');
});

document.querySelector('#downloadPlan').addEventListener('click', () => {
  const subject = document.querySelector('#subject').value;
  const grade = document.querySelector('#grade').value;
  const topic = document.querySelector('#topic').value;
  const objective = document.querySelector('#objective').value;
  const text = `ҚЫСҚА МЕРЗІМДІ ЖОСПАР\n\nПән: ${subject}\nСынып: ${grade}\nСабақтың тақырыбы: ${topic}\nОқу мақсаты: ${objective}\n\nСабақтың басы: Сәлемдесу, жағымды ахуал қалыптастыру, алдыңғы білімді белсендіру.\n\nСабақтың ортасы: Жаңа тақырып, жұптық және топтық жұмыс, дескриптор арқылы бағалау.\n\nСабақтың соңы: Қорытынды, кері байланыс және рефлексия.`;
  const blob = new Blob([text], {type: 'application/msword'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `QMJ-${subject}-${grade}.doc`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('ҚМЖ файлы жүктелді');
});

document.querySelectorAll('[data-open-auth]').forEach((button) => {
  button.addEventListener('click', () => {
    const login = button.dataset.openAuth === 'login';
    document.querySelector('#dialogTitle').textContent = login ? 'Аккаунтқа кіру' : 'Тегін тіркелу';
    document.querySelector('#dialogText').textContent = login ? 'ҚМЖ мұрағатыңызды ашыңыз' : '3 ҚМЖ-ны тегін жасап көріңіз';
    authDialog.showModal();
  });
});

document.querySelector('#closeDialog').addEventListener('click', () => authDialog.close());
document.querySelector('#authForm').addEventListener('submit', (event) => {
  event.preventDefault();
  authDialog.close();
  showToast('Демо режимде аккаунт серверге жіберілмейді');
});

const savedPlan = localStorage.getItem('qmj-demo-plan');
if (savedPlan) {
  try {
    const plan = JSON.parse(savedPlan);
    document.querySelector('#grade').value = plan.grade || '';
    document.querySelector('#subject').value = plan.subject || '';
    document.querySelector('#topic').value = plan.topic || '';
    document.querySelector('#objective').value = plan.objective || '';
  } catch (_) { localStorage.removeItem('qmj-demo-plan'); }
}
