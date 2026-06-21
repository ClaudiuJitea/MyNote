// Global State
let state = {
    userId: null,
    role: null,
    email: null,
    notebooks: [],
    sectionsCache: {},
    pagesCache: {},
    expanded: { root: true, starred: true, notebooks: new Set(), sections: new Set() },
    selectedSection: null,
    activeNotebook: null,
    activeSection: null,
    activePage: null,
    starredPages: [],
    hasAiKey: false,
    aiModel: 'google/gemma-4-26b-a4b-it'
};

let csrfToken = null;

async function fetchCsrfToken() {
    const res = await fetch('api/auth.php?action=csrf', { credentials: 'same-origin' });
    const data = await res.json();
    csrfToken = data.csrf_token || null;
    return csrfToken;
}

async function apiFetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const opts = { credentials: 'same-origin', ...options };

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        if (!csrfToken) {
            await fetchCsrfToken();
        }

        if (opts.body instanceof FormData) {
            if (csrfToken) {
                opts.body.append('csrf_token', csrfToken);
            }
        } else {
            const headers = new Headers(opts.headers || {});
            if (csrfToken) {
                headers.set('X-CSRF-Token', csrfToken);
            }
            if (!headers.has('Content-Type') && typeof opts.body === 'string') {
                headers.set('Content-Type', 'application/json');
            }
            opts.headers = headers;
        }
    }

    return fetch(url, opts);
}

// DOM Elements
const authView = document.getElementById('authView');
const dashboardView = document.getElementById('dashboardView');
const authForm = document.getElementById('authForm');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const authError = document.getElementById('authError');

const treeView = document.getElementById('treeView');
const treeScrollArea = document.querySelector('.tree-scroll-area');
const treeActiveSlider = document.getElementById('treeActiveSlider');
const dashboardLayout = document.getElementById('dashboardLayout');
const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
const sidebarExpandBtn = document.getElementById('sidebarExpandBtn');
const railNotebooks = document.getElementById('railNotebooks');
const railNewNotebookBtn = document.getElementById('railNewNotebookBtn');
const railActiveNoteBtn = document.getElementById('railActiveNoteBtn');
const railThemeBtn = document.getElementById('railThemeBtn');
const railAdminBtn = document.getElementById('railAdminBtn');
const railLogoutBtn = document.getElementById('railLogoutBtn');
const sidebarFlyout = document.getElementById('sidebarFlyout');
const sidebarFlyoutTitle = document.getElementById('sidebarFlyoutTitle');
const sidebarFlyoutBody = document.getElementById('sidebarFlyoutBody');
const sidebarFlyoutCloseBtn = document.getElementById('sidebarFlyoutCloseBtn');
const sidebarNotesPanel = document.getElementById('sidebarNotesPanel');
const sidebarNotesPanelTitle = document.getElementById('sidebarNotesPanelTitle');
const sidebarNotesPanelBreadcrumb = document.getElementById('sidebarNotesPanelBreadcrumb');
const sidebarNotesPanelBody = document.getElementById('sidebarNotesPanelBody');
const sidebarNotesPanelCloseBtn = document.getElementById('sidebarNotesPanelCloseBtn');

let railFlyoutNotebookId = null;
const editorArea = document.getElementById('editorArea');
const emptyEditor = document.getElementById('emptyEditor');
const pageTitle = document.getElementById('pageTitle');
const saveStatus = document.getElementById('saveStatus');
const editorMeta = document.getElementById('editorMeta');
const editorBreadcrumb = document.getElementById('editorBreadcrumb');
const editorUndoBtn = document.getElementById('editorUndoBtn');
const editorRedoBtn = document.getElementById('editorRedoBtn');
const editorTocBtn = document.getElementById('editorTocBtn');
const editorFocusBtn = document.getElementById('editorFocusBtn');
const editorDrawBtn = document.getElementById('editorDrawBtn');
const editorAiBtn = document.getElementById('editorAiBtn');
const editorToc = document.getElementById('editorToc');
const editorTocList = document.getElementById('editorTocList');
const editorTocEmpty = document.getElementById('editorTocEmpty');
const editorTocCloseBtn = document.getElementById('editorTocCloseBtn');
const editorWordCount = document.getElementById('editorWordCount');
const editorCharCount = document.getElementById('editorCharCount');
const editorReadTime = document.getElementById('editorReadTime');
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const searchResults = document.getElementById('searchResults');
const homeBtn = document.getElementById('homeBtn');
const editorFavoriteBtn = document.getElementById('editorFavoriteBtn');
const homeRecentList = document.getElementById('homeRecentList');
const homeFavoritesList = document.getElementById('homeFavoritesList');

const RECENT_PAGES_STORAGE_KEY = 'mynote_recent_pages';

const adminPanelBtn = document.getElementById('adminPanelBtn');
const adminView = document.getElementById('adminView');
const userPanelBtn = document.getElementById('userPanelBtn');
const userView = document.getElementById('userView');
const closeUserBtn = document.getElementById('closeUserBtn');
const userImportSummary = document.getElementById('userImportSummary');
const closeAdminBtn = document.getElementById('closeAdminBtn');
const adminCreateUserForm = document.getElementById('adminCreateUserForm');
const adminUsersList = document.getElementById('adminUsersList');
const exportNotesBtn = document.getElementById('exportNotesBtn');
const importNotesBtn = document.getElementById('importNotesBtn');
const importNotesInput = document.getElementById('importNotesInput');
const userImportMode = document.getElementById('userImportMode');
const exportSystemBtn = document.getElementById('exportSystemBtn');
const importSystemBtn = document.getElementById('importSystemBtn');
const importSystemInput = document.getElementById('importSystemInput');
const systemImportMode = document.getElementById('systemImportMode');
const adminImportSummary = document.getElementById('adminImportSummary');
const userAiSettingsForm = document.getElementById('userAiSettingsForm');
const userOpenrouterKey = document.getElementById('userOpenrouterKey');
const userOpenrouterModel = document.getElementById('userOpenrouterModel');
const userOpenrouterKeyStatus = document.getElementById('userOpenrouterKeyStatus');
const userTestAiBtn = document.getElementById('userTestAiBtn');
const userRemoveAiKeyBtn = document.getElementById('userRemoveAiKeyBtn');
const userAiSettingsSummary = document.getElementById('userAiSettingsSummary');
const adminAiSettingsForm = document.getElementById('adminAiSettingsForm');
const adminOpenrouterKey = document.getElementById('adminOpenrouterKey');
const adminOpenrouterModel = document.getElementById('adminOpenrouterModel');
const adminOpenrouterKeyStatus = document.getElementById('adminOpenrouterKeyStatus');
const adminTestAiBtn = document.getElementById('adminTestAiBtn');
const adminRemoveAiKeyBtn = document.getElementById('adminRemoveAiKeyBtn');
const adminAiSettingsSummary = document.getElementById('adminAiSettingsSummary');

let quill;
let saveTimeout;
let editorTocTimeout;
let editorStatsTimeout;
let editorTocObserver = null;
let modalResolve = null;
let modalType = 'alert';
let aiModalPhase = 'input';
let aiModalTarget = null;
let aiModalResultText = '';
let aiModalApplyTarget = 'content';
let aiModalScopeInfo = null;
let aiModalPresetAction = null;
let aiModalEmptyNoteMode = false;
let aiModalAdvancedExpanded = false;
let treeLabelEdit = null;
let pageLabelClickTimer = null;
let flyoutPageClickTimer = null;

const modalOverlay = document.getElementById('modalOverlay');
const modalEl = modalOverlay?.querySelector('.modal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalInput = document.getElementById('modalInput');
const modalLocationPicker = document.getElementById('modalLocationPicker');
const modalNotebookSelect = document.getElementById('modalNotebookSelect');
const modalSectionSelect = document.getElementById('modalSectionSelect');
const modalNewNotebookInput = document.getElementById('modalNewNotebookInput');
const modalNewSectionInput = document.getElementById('modalNewSectionInput');
const modalAiPanel = document.getElementById('modalAiPanel');
const modalAiCompose = document.getElementById('modalAiCompose');
const modalAiComposeInput = document.getElementById('modalAiComposeInput');
const modalAiSuggestionChips = document.getElementById('modalAiSuggestionChips');
const modalAiAdvancedToggle = document.getElementById('modalAiAdvancedToggle');
const modalAiAdvanced = document.getElementById('modalAiAdvanced');
const modalAiAction = document.getElementById('modalAiAction');
const modalAiLangLabel = document.getElementById('modalAiLangLabel');
const modalAiLang = document.getElementById('modalAiLang');
const modalAiTopicLabel = document.getElementById('modalAiTopicLabel');
const modalAiTopic = document.getElementById('modalAiTopic');
const modalAiQuestionLabel = document.getElementById('modalAiQuestionLabel');
const modalAiQuestion = document.getElementById('modalAiQuestion');
const modalAiPromptLabel = document.getElementById('modalAiPromptLabel');
const modalAiPrompt = document.getElementById('modalAiPrompt');
const modalAiApplyLabel = document.getElementById('modalAiApplyLabel');
const modalAiApplyMode = document.getElementById('modalAiApplyMode');
const modalAiScope = document.getElementById('modalAiScope');
const modalAiLoading = document.getElementById('modalAiLoading');
const modalAiResultLabel = document.getElementById('modalAiResultLabel');
const modalAiResult = document.getElementById('modalAiResult');
const modalCancelBtn = document.getElementById('modalCancel');
const modalConfirmBtn = document.getElementById('modalConfirm');
const emptyCreateNoteBtn = document.getElementById('emptyCreateNoteBtn');
const treeContextMenu = document.getElementById('treeContextMenu');

const NEW_NOTEBOOK_OPTION = '__new_notebook__';
const NEW_SECTION_OPTION = '__new_section__';

const AI_ACTION_UI = {
    translate: { needsLang: true },
    generate: { needsTopic: true, allowsEmptyNote: true, defaultApply: 'replace' },
    brainstorm: { needsTopic: true, allowsEmptyNote: true, defaultApply: 'append' },
    ask: { needsQuestion: true, defaultApply: 'append' },
    custom: { needsPrompt: true, allowsEmptyNote: true },
    summarize_section: { usesScope: 'section', allowsEmptyNote: true, defaultApply: 'append' },
    summarize_notebook: { usesScope: 'notebook', allowsEmptyNote: true, defaultApply: 'append' },
    title: { applyTarget: 'title' },
    continue: { defaultApply: 'append', forceAppend: true },
    summarize: { defaultApply: 'append' },
    key_points: { defaultApply: 'append' },
    outline: { defaultApply: 'append' },
    flashcards: { defaultApply: 'append' },
    quiz: { defaultApply: 'append' },
    memorize: { defaultApply: 'append' },
    study_plan: { defaultApply: 'append' },
    actions: { defaultApply: 'append' },
    keywords: { defaultApply: 'append' },
    explain: { defaultApply: 'append' }
};

const AI_COMPOSE_SUGGESTIONS = [
    'Write a structured note about ',
    'Brainstorm ideas for ',
    'Create a study guide on ',
    'Draft meeting notes for ',
    'Make flashcards about ',
    'Explain simply: '
];

const AI_LANGUAGES = [
    'English', 'Romanian', 'French', 'German', 'Spanish', 'Italian',
    'Portuguese', 'Dutch', 'Polish', 'Russian', 'Ukrainian',
    'Chinese (Simplified)', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Turkish'
];

const AI_COMMANDS = [
    { id: 'improve', label: 'Improve writing', desc: 'Clarity and readability', icon: 'fa-pen-fancy', group: 'Writing', keywords: ['edit', 'polish'] },
    { id: 'grammar', label: 'Fix grammar & spelling', desc: 'Correct mistakes', icon: 'fa-spell-check', group: 'Writing', keywords: ['proofread'] },
    { id: 'shorter', label: 'Make shorter', desc: 'Condense while keeping key points', icon: 'fa-scissors', group: 'Writing', keywords: ['condense', 'trim'] },
    { id: 'expand', label: 'Expand & elaborate', desc: 'Add detail and examples', icon: 'fa-up-right-and-down-left-from-center', group: 'Writing', keywords: ['elaborate', 'detail'] },
    { id: 'formal', label: 'Make formal', desc: 'Professional tone', icon: 'fa-briefcase', group: 'Writing', keywords: ['professional'] },
    { id: 'casual', label: 'Make casual', desc: 'Friendly conversational tone', icon: 'fa-face-smile', group: 'Writing', keywords: ['friendly'] },
    { id: 'continue', label: 'Continue writing', desc: 'Pick up where you left off', icon: 'fa-forward', group: 'Writing', keywords: ['extend'] },
    { id: 'summarize', label: 'Summarize', desc: 'Concise overview', icon: 'fa-compress', group: 'Understand', keywords: ['summary', 'tldr'] },
    { id: 'key_points', label: 'Extract key points', desc: 'Bullet list of essentials', icon: 'fa-list-check', group: 'Understand', keywords: ['bullets', 'highlights'] },
    { id: 'outline', label: 'Create outline', desc: 'Structured sections', icon: 'fa-sitemap', group: 'Understand', keywords: ['structure'] },
    { id: 'explain', label: 'Explain simply', desc: 'Easy-to-understand explanation', icon: 'fa-lightbulb', group: 'Understand', keywords: ['eli5', 'simple'] },
    { id: 'keywords', label: 'Extract keywords', desc: 'Tags and key terms', icon: 'fa-tags', group: 'Understand', keywords: ['tags'] },
    { id: 'ask', label: 'Ask about this note', desc: 'Q&A from note content', icon: 'fa-circle-question', group: 'Understand', keywords: ['question'] },
    { id: 'translate', label: 'Translate', desc: 'Convert to another language', icon: 'fa-language', group: 'Translate', keywords: ['language'] },
    { id: 'generate', label: 'Write on a topic', desc: 'Generate new content', icon: 'fa-file-pen', group: 'Create', keywords: ['write', 'draft'] },
    { id: 'brainstorm', label: 'Brainstorm ideas', desc: 'Creative angles and ideas', icon: 'fa-brain', group: 'Create', keywords: ['ideas'] },
    { id: 'title', label: 'Suggest title', desc: 'Generate a note title', icon: 'fa-heading', group: 'Create', keywords: ['rename'] },
    { id: 'flashcards', label: 'Generate flashcards', desc: 'Q&A study cards', icon: 'fa-clone', group: 'Study', keywords: ['cards', 'memorize'] },
    { id: 'quiz', label: 'Study quiz', desc: 'Test your knowledge', icon: 'fa-clipboard-question', group: 'Study', keywords: ['test'] },
    { id: 'memorize', label: 'Memory tips', desc: 'Mnemonics and recall strategies', icon: 'fa-bolt', group: 'Study', keywords: ['mnemonic'] },
    { id: 'study_plan', label: 'Create study plan', desc: 'Sessions and review steps', icon: 'fa-calendar-check', group: 'Study', keywords: ['schedule'] },
    { id: 'actions', label: 'Extract to-do items', desc: 'Actionable checklist', icon: 'fa-list-ul', group: 'Study', keywords: ['tasks', 'todo'] },
    { id: 'summarize_section', label: 'Summarize subfolder', desc: 'Overview of all notes in subfolder', icon: 'fa-folder-tree', group: 'Folder', keywords: ['folder'] },
    { id: 'summarize_notebook', label: 'Summarize folder', desc: 'Overview of entire folder', icon: 'fa-folder-open', group: 'Folder', keywords: ['notebook'] },
    { id: 'custom', label: 'Custom instructions', desc: 'Tell AI exactly what to do', icon: 'fa-sliders', group: 'Advanced', keywords: ['custom', 'prompt'] }
];

const aiPaletteOverlay = document.getElementById('aiPaletteOverlay');
const aiPaletteViewCompose = document.getElementById('aiPaletteViewCompose');
const aiPaletteComposeInput = document.getElementById('aiPaletteComposeInput');
const aiPaletteSuggestionChips = document.getElementById('aiPaletteSuggestionChips');
const aiPaletteViewPicker = document.getElementById('aiPaletteViewPicker');
const aiPaletteSearch = document.getElementById('aiPaletteSearch');
const aiPaletteScopeBadge = document.getElementById('aiPaletteScopeBadge');
const aiPaletteList = document.getElementById('aiPaletteList');
const aiPaletteViewConfig = document.getElementById('aiPaletteViewConfig');
const aiPaletteConfigIcon = document.getElementById('aiPaletteConfigIcon');
const aiPaletteConfigTitle = document.getElementById('aiPaletteConfigTitle');
const aiPaletteConfigDesc = document.getElementById('aiPaletteConfigDesc');
const aiPaletteConfigBody = document.getElementById('aiPaletteConfigBody');
const aiPaletteApplyWrap = document.getElementById('aiPaletteApplyWrap');
const aiPaletteApplySegments = document.getElementById('aiPaletteApplySegments');
const aiPaletteViewLoading = document.getElementById('aiPaletteViewLoading');
const aiPaletteLoadingText = document.getElementById('aiPaletteLoadingText');
const aiPaletteLoadingAction = document.getElementById('aiPaletteLoadingAction');
const aiPaletteViewResult = document.getElementById('aiPaletteViewResult');
const aiPaletteResultTitle = document.getElementById('aiPaletteResultTitle');
const aiPaletteResultText = document.getElementById('aiPaletteResultText');
const aiSelectionBar = document.getElementById('aiSelectionBar');

const sketchOverlay = document.getElementById('sketchOverlay');
const sketchCanvas = document.getElementById('sketchCanvas');
const sketchResizeHandle = document.getElementById('sketchResizeHandle');
const sketchCloseBtn = document.getElementById('sketchCloseBtn');
const sketchUndoBtn = document.getElementById('sketchUndoBtn');
const sketchClearBtn = document.getElementById('sketchClearBtn');
const sketchCancelBtn = document.getElementById('sketchCancelBtn');
const sketchInsertBtn = document.getElementById('sketchInsertBtn');
const sketchCanvasSizeLabel = document.getElementById('sketchCanvasSizeLabel');
const sketchCropToggle = document.getElementById('sketchCropToggle');
const sketchColorGrid = document.getElementById('sketchColorGrid');
const sketchColorPicker = document.getElementById('sketchColorPicker');
const sketchSizeLabel = document.getElementById('sketchSizeLabel');
const sketchSizeValue = document.getElementById('sketchSizeValue');
const sketchSizePrev = document.getElementById('sketchSizePrev');
const sketchSizeNext = document.getElementById('sketchSizeNext');
const sketchTextInput = document.getElementById('sketchTextInput');

const SKETCH_CANVAS_MIN = { width: 200, height: 150 };
const SKETCH_CANVAS_MAX = { width: 1600, height: 1200 };
const SKETCH_SHAPE_TOOLS = new Set(['line', 'arrow', 'rect', 'fillRect', 'ellipse']);
const SKETCH_BRUSH_SIZES = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];
const SKETCH_TEXT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 32, 40, 48];
const SKETCH_PALETTE = [
    '#1c1917', '#ffffff', '#9ca3af', '#dc2626', '#ea580c', '#eab308',
    '#16a34a', '#059669', '#2563eb', '#4338ca', '#7c3aed', '#db2777',
    '#0891b2', '#0d9488', '#92400e', '#64748b', '#000000', '#f472b6'
];

const sketchSession = {
    strokes: [],
    undone: [],
    currentStroke: null,
    tool: 'pen',
    color: '#1c1917',
    sizeIndex: 3,
    canvasWidth: 640,
    canvasHeight: 400,
    isDrawing: false,
    isResizing: false,
    dpr: 1
};

let sketchResizeState = null;
let sketchTextEdit = null;

let aiPaletteHighlight = 0;
let aiPaletteFilteredItems = [];
let aiPaletteForm = {
    action: 'improve',
    prompt: '',
    topic: '',
    question: '',
    targetLang: 'English',
    applyMode: 'replace',
    composeText: ''
};

function initModal() {
    modalCancelBtn.onclick = () => closeModal(null);
    modalConfirmBtn.onclick = () => {
        if (modalType === 'location') {
            const result = readLocationPickerSelection();
            if (!result) return;
            closeModal(result);
            return;
        }
        if (!modalInput.classList.contains('hidden')) {
            closeModal(modalInput.value.trim());
        } else {
            closeModal(true);
        }
    };
    modalInput.onkeydown = (e) => {
        if (e.key === 'Enter') modalConfirmBtn.click();
        if (e.key === 'Escape') modalCancelBtn.click();
    };
    modalNewNotebookInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') modalConfirmBtn.click();
    });
    modalNewSectionInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') modalConfirmBtn.click();
    });
    modalNotebookSelect?.addEventListener('change', updateLocationPickerSections);
    modalSectionSelect?.addEventListener('change', updateLocationPickerNewSectionVisibility);
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) closeModal(null);
    };
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
            closeModal(null);
        }
    });
}

function resetModalFields() {
    modalLocationPicker?.classList.add('hidden');
    modalAiPanel?.classList.add('hidden');
    modalEl?.classList.remove('modal-wide');
    modalEl?.classList.remove('modal-ai-compose-mode');
    modalNewNotebookInput?.classList.add('hidden');
    modalNewSectionInput?.classList.add('hidden');
    modalNewNotebookInput.value = '';
    modalNewSectionInput.value = '';
    modalAiPrompt?.classList.add('hidden');
    modalAiPromptLabel?.classList.add('hidden');
    modalAiPrompt.value = '';
    modalAiLang?.classList.add('hidden');
    modalAiLangLabel?.classList.add('hidden');
    modalAiTopic?.classList.add('hidden');
    modalAiTopicLabel?.classList.add('hidden');
    modalAiTopic.value = '';
    modalAiQuestion?.classList.add('hidden');
    modalAiQuestionLabel?.classList.add('hidden');
    modalAiQuestion.value = '';
    modalAiApplyMode?.classList.add('hidden');
    modalAiApplyLabel?.classList.add('hidden');
    modalAiCompose?.classList.add('hidden');
    if (modalAiComposeInput) modalAiComposeInput.value = '';
    modalAiAdvanced?.classList.remove('is-collapsed');
    modalAiAdvancedToggle?.classList.add('hidden');
    modalAiLoading?.classList.add('hidden');
    modalAiResult?.classList.add('hidden');
    modalAiResultLabel?.classList.add('hidden');
    modalAiResult.value = '';
    if (modalAiScope) {
        modalAiScope.textContent = '';
        modalAiScope.classList.remove('hidden');
    }
    aiModalPhase = 'input';
    aiModalTarget = null;
    aiModalResultText = '';
    aiModalApplyTarget = 'content';
    aiModalScopeInfo = null;
    aiModalPresetAction = null;
    aiModalEmptyNoteMode = false;
    aiModalAdvancedExpanded = false;
    modalType = 'alert';
}

function showModal({ type, title, message, placeholder, defaultValue, confirmText, cancelText, danger }) {
    return new Promise((resolve) => {
        modalResolve = resolve;
        modalType = type;
        modalTitle.textContent = title;

        if (message) {
            modalMessage.textContent = message;
            modalMessage.classList.remove('hidden');
        } else {
            modalMessage.classList.add('hidden');
        }

        modalConfirmBtn.textContent = confirmText || 'OK';
        modalConfirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';

        resetModalFields();
        modalType = type;

        if (type === 'prompt') {
            modalInput.classList.remove('hidden');
            modalInput.value = defaultValue || '';
            modalInput.placeholder = placeholder || '';
            modalCancelBtn.classList.remove('hidden');
            modalCancelBtn.textContent = cancelText || 'Cancel';
        } else if (type === 'confirm') {
            modalInput.classList.add('hidden');
            modalCancelBtn.classList.remove('hidden');
            modalCancelBtn.textContent = cancelText || 'Cancel';
        } else {
            modalInput.classList.add('hidden');
            modalCancelBtn.classList.add('hidden');
        }

        modalOverlay.classList.remove('hidden');
        modalOverlay.classList.toggle(
            'modal-above-sketch',
            !!(sketchOverlay && !sketchOverlay.classList.contains('hidden'))
        );
        requestAnimationFrame(() => {
            if (type === 'prompt') modalInput.focus();
            else modalConfirmBtn.focus();
        });
    });
}

function closeModal(result) {
    modalOverlay.classList.add('hidden');
    modalOverlay.classList.remove('modal-above-sketch');
    resetModalFields();
    if (modalResolve) {
        modalResolve(result);
        modalResolve = null;
    }
}

function modalPrompt(title, placeholder) {
    return showModal({ type: 'prompt', title, placeholder, confirmText: 'Create' });
}

function modalConfirm(message, title = 'Confirm', confirmText = 'Delete') {
    return showModal({ type: 'confirm', title, message, confirmText, danger: confirmText === 'Delete' });
}

function modalAlert(message, title = 'Notice') {
    return showModal({ type: 'alert', title, message, confirmText: 'OK' });
}

function findNotebookIdForSection(sectionId) {
    for (const nb of state.notebooks) {
        const sections = state.sectionsCache[nb.id] || [];
        if (sections.some(s => s.id == sectionId)) {
            return nb.id;
        }
    }
    return null;
}

async function ensureAllSectionsLoaded() {
    for (const nb of state.notebooks) {
        if (!state.sectionsCache[nb.id]) {
            await loadSectionsForNotebook(nb.id);
        }
    }
}

function populateLocationPickerNotebooks() {
    const options = state.notebooks.map(nb =>
        `<option value="${nb.id}">${escapeHtml(nb.name)}</option>`
    ).join('');
    modalNotebookSelect.innerHTML = `${options}<option value="${NEW_NOTEBOOK_OPTION}">+ Create new folder…</option>`;
}

function updateLocationPickerSections() {
    const notebookVal = modalNotebookSelect.value;
    const isNewNotebook = notebookVal === NEW_NOTEBOOK_OPTION;

    modalNewNotebookInput.classList.toggle('hidden', !isNewNotebook);
    if (isNewNotebook) {
        modalNewNotebookInput.value = '';
    }

    if (isNewNotebook) {
        modalSectionSelect.innerHTML = `<option value="${NEW_SECTION_OPTION}">+ Create new subfolder…</option>`;
        modalSectionSelect.value = NEW_SECTION_OPTION;
        modalNewSectionInput.classList.remove('hidden');
        modalNewSectionInput.value = '';
        return;
    }

    const sections = state.sectionsCache[notebookVal] || [];
    if (sections.length === 0) {
        modalSectionSelect.innerHTML = `<option value="${NEW_SECTION_OPTION}">+ Create new subfolder…</option>`;
        modalSectionSelect.value = NEW_SECTION_OPTION;
    } else {
        modalSectionSelect.innerHTML = sections.map(section =>
            `<option value="${section.id}">${escapeHtml(section.name)}</option>`
        ).join('') + `<option value="${NEW_SECTION_OPTION}">+ Create new subfolder…</option>`;
    }

    updateLocationPickerNewSectionVisibility();
}

function updateLocationPickerNewSectionVisibility() {
    const isNewSection = modalSectionSelect.value === NEW_SECTION_OPTION;
    modalNewSectionInput.classList.toggle('hidden', !isNewSection);
}

function setLocationPickerDefaults() {
    populateLocationPickerNotebooks();

    if (state.notebooks.length === 0) {
        modalNotebookSelect.value = NEW_NOTEBOOK_OPTION;
        updateLocationPickerSections();
        return;
    }

    let notebookId = state.activeNotebook;
    if (state.activeSection) {
        notebookId = findNotebookIdForSection(state.activeSection) || notebookId;
    }
    if (notebookId && state.notebooks.some(nb => nb.id == notebookId)) {
        modalNotebookSelect.value = String(notebookId);
    }

    updateLocationPickerSections();

    if (state.activeSection) {
        const sectionOption = modalSectionSelect.querySelector(`option[value="${state.activeSection}"]`);
        if (sectionOption) {
            modalSectionSelect.value = String(state.activeSection);
            updateLocationPickerNewSectionVisibility();
        }
    }
}

function readLocationPickerSelection() {
    const notebookVal = modalNotebookSelect.value;
    const sectionVal = modalSectionSelect.value;
    const selection = {
        notebookId: notebookVal === NEW_NOTEBOOK_OPTION ? NEW_NOTEBOOK_OPTION : parseInt(notebookVal, 10),
        notebookName: null,
        sectionId: sectionVal === NEW_SECTION_OPTION ? NEW_SECTION_OPTION : parseInt(sectionVal, 10),
        sectionName: null
    };

    if (notebookVal === NEW_NOTEBOOK_OPTION) {
        selection.notebookName = modalNewNotebookInput.value.trim();
        if (!selection.notebookName) {
            modalNewNotebookInput.focus();
            return null;
        }
        selection.sectionId = NEW_SECTION_OPTION;
        selection.sectionName = modalNewSectionInput.value.trim();
        if (!selection.sectionName) {
            modalNewSectionInput.focus();
            return null;
        }
        return selection;
    }

    if (sectionVal === NEW_SECTION_OPTION) {
        selection.sectionName = modalNewSectionInput.value.trim();
        if (!selection.sectionName) {
            modalNewSectionInput.focus();
            return null;
        }
    }

    return selection;
}

async function modalPickNoteLocation() {
    await ensureAllSectionsLoaded();

    return new Promise((resolve) => {
        modalResolve = resolve;
        modalType = 'location';
        modalTitle.textContent = 'New note';
        modalMessage.textContent = 'Choose where to save this note. Notes are stored inside a subfolder.';
        modalMessage.classList.remove('hidden');
        modalInput.classList.add('hidden');
        modalLocationPicker.classList.remove('hidden');
        modalEl?.classList.add('modal-wide');
        modalCancelBtn.classList.remove('hidden');
        modalCancelBtn.textContent = 'Cancel';
        modalConfirmBtn.textContent = 'Create note';
        modalConfirmBtn.className = 'btn btn-primary';

        setLocationPickerDefaults();
        modalOverlay.classList.remove('hidden');

        requestAnimationFrame(() => {
            if (modalNotebookSelect.value === NEW_NOTEBOOK_OPTION) {
                modalNewNotebookInput.focus();
            } else {
                modalNotebookSelect.focus();
            }
        });
    });
}

async function createNoteWithLocationPicker() {
    const location = await modalPickNoteLocation();
    if (!location) return;

    let sectionId = location.sectionId;

    if (location.notebookId === NEW_NOTEBOOK_OPTION) {
        const res = await apiFetch('api/notebooks.php', {
            method: 'POST',
            body: JSON.stringify({ name: location.notebookName })
        });
        const notebook = await res.json();
        if (!notebook?.id) {
            await modalAlert('Could not create the folder. Please try again.', 'Create failed');
            return;
        }

        state.notebooks.unshift(notebook);
        state.expanded.root = true;
        state.expanded.notebooks.add(String(notebook.id));
        state.sectionsCache[notebook.id] = [];
        state.activeNotebook = notebook.id;
        sectionId = await createSectionWithName(notebook.id, location.sectionName);
    } else if (location.sectionId === NEW_SECTION_OPTION) {
        sectionId = await createSectionWithName(location.notebookId, location.sectionName);
    }

    if (!sectionId) {
        await modalAlert('Could not create the subfolder. Please try again.', 'Create failed');
        return;
    }

    renderTree();
    await createPage(sectionId);
}

function initEmptyState() {
    emptyCreateNoteBtn?.addEventListener('click', () => {
        createNoteWithLocationPicker();
    });

    emptyEditor?.addEventListener('click', (e) => {
        const item = e.target.closest('.home-note-item[data-page-id]');
        if (item) {
            openPage(item.dataset.pageId);
        }
    });
}

function getRecentPagesStorageKey() {
    return state.userId ? `${RECENT_PAGES_STORAGE_KEY}_${state.userId}` : RECENT_PAGES_STORAGE_KEY;
}

function loadStoredRecentPageIds() {
    try {
        const raw = localStorage.getItem(getRecentPagesStorageKey());
        const ids = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(ids)) return [];
        return ids
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0);
    } catch {
        return [];
    }
}

function loadRecentPageIds(limit = 3) {
    return loadStoredRecentPageIds().slice(0, limit);
}

function saveRecentPageIds(ids) {
    localStorage.setItem(getRecentPagesStorageKey(), JSON.stringify(ids.slice(0, 10)));
}

function recordRecentPage(pageId) {
    const id = Number(pageId);
    if (!id) return;
    const ids = loadStoredRecentPageIds().filter(existingId => existingId !== id);
    ids.unshift(id);
    saveRecentPageIds(ids);
}

function removeRecentPage(pageId) {
    const id = Number(pageId);
    if (!id) return;
    saveRecentPageIds(loadStoredRecentPageIds().filter(existingId => existingId !== id));
}

function renderHomeNoteItem(note) {
    const title = escapeHtml(note.title || 'Untitled');
    const path = escapeHtml(`${note.notebook_name || 'Folder'} / ${note.section_name || 'Subfolder'}`);
    const meta = note.updated_at ? escapeHtml(formatRelativeTime(note.updated_at)) : '';
    const isFavorite = Number(note.is_favorite) === 1;

    return `
        <button type="button" class="home-note-item" data-page-id="${note.id}">
            <span class="home-note-icon" aria-hidden="true"><i class="fa-regular fa-file-lines"></i></span>
            <span class="home-note-body">
                <span class="home-note-title">
                    ${title}
                    ${isFavorite ? '<i class="fa-solid fa-star home-note-star" aria-hidden="true"></i>' : ''}
                </span>
                <span class="home-note-path">${path}</span>
            </span>
            ${meta ? `<span class="home-note-meta">${meta}</span>` : ''}
        </button>
    `;
}

function renderHomeNoteEmpty(message) {
    return `<p class="home-note-empty">${escapeHtml(message)}</p>`;
}

async function renderHomePage() {
    if (!homeRecentList || !homeFavoritesList || !state.userId) return;

    homeRecentList.innerHTML = renderHomeNoteEmpty('Loading…');
    homeFavoritesList.innerHTML = renderHomeNoteEmpty('Loading…');

    const recentIds = loadRecentPageIds(3);
    const params = new URLSearchParams({ highlights: '1' });
    if (recentIds.length) {
        params.set('recent', recentIds.join(','));
    }

    try {
        const res = await apiFetch(`api/pages.php?${params}`);
        const data = await res.json();
        const recent = Array.isArray(data.recent) ? data.recent : [];
        const favorites = Array.isArray(data.favorites) ? data.favorites : [];

        homeRecentList.innerHTML = recent.length
            ? recent.map(renderHomeNoteItem).join('')
            : renderHomeNoteEmpty('No recent notes yet. Open a note from the sidebar.');

        homeFavoritesList.innerHTML = favorites.length
            ? favorites.map(renderHomeNoteItem).join('')
            : renderHomeNoteEmpty('Star a note while editing to add it here.');
    } catch {
        homeRecentList.innerHTML = renderHomeNoteEmpty('Could not load recent notes.');
        homeFavoritesList.innerHTML = renderHomeNoteEmpty('Could not load favorites.');
    }
}

async function refreshHomePage() {
    if (!emptyEditor || emptyEditor.classList.contains('hidden') || !state.userId) return;
    await renderHomePage();
}

function isPageStarred(pageId) {
    const id = Number(pageId);
    if (!id) return false;
    if (state.activePage?.id == id) {
        return Number(state.activePage.is_favorite) === 1;
    }
    for (const sectionId of Object.keys(state.pagesCache)) {
        const page = state.pagesCache[sectionId]?.find(p => p.id == id);
        if (page) {
            return Number(page.is_favorite) === 1;
        }
    }
    return state.starredPages.some(p => p.id == id);
}

async function loadStarredPages() {
    if (!state.userId) {
        state.starredPages = [];
        return;
    }

    try {
        const res = await apiFetch('api/pages.php?starred=1');
        const data = await res.json();
        state.starredPages = Array.isArray(data) ? data : [];
    } catch {
        state.starredPages = [];
    }
}

function syncPageFavoriteInCache(pageId, isFavorite) {
    const id = Number(pageId);
    const value = isFavorite ? 1 : 0;

    for (const sectionId of Object.keys(state.pagesCache)) {
        const page = state.pagesCache[sectionId]?.find(p => p.id == id);
        if (page) {
            page.is_favorite = value;
        }
    }

    if (state.activePage?.id == id) {
        state.activePage.is_favorite = value;
        updateFavoriteButton(!!isFavorite);
    }
}

async function setPageFavorite(pageId, isFavorite) {
    const id = Number(pageId);
    if (!id) return false;

    const newValue = isFavorite ? 1 : 0;
    const res = await apiFetch('api/pages.php', {
        method: 'PUT',
        body: JSON.stringify({ id, is_favorite: newValue })
    });
    if (!res.ok) return false;

    syncPageFavoriteInCache(id, isFavorite);
    await loadStarredPages();
    renderTree();
    await refreshHomePage();
    return true;
}

async function toggleFavoriteForPage(pageId) {
    return setPageFavorite(pageId, !isPageStarred(pageId));
}

function updateFavoriteButton(isFavorite) {
    if (!editorFavoriteBtn) return;
    const active = !!isFavorite;
    editorFavoriteBtn.classList.toggle('is-favorite', active);
    editorFavoriteBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    editorFavoriteBtn.title = active ? 'Remove from Starred' : 'Add to Starred';
    editorFavoriteBtn.setAttribute('aria-label', active ? 'Remove from Starred' : 'Add to Starred');
    const icon = editorFavoriteBtn.querySelector('i');
    if (icon) {
        icon.className = active ? 'fa-solid fa-star' : 'fa-regular fa-star';
    }
    const label = editorFavoriteBtn.querySelector('.editor-action-label');
    if (label) {
        label.textContent = active ? 'Starred' : 'Star';
    }
}

async function toggleFavorite() {
    if (!state.activePage) return;
    await toggleFavoriteForPage(state.activePage.id);
}

function initEditorFavorite() {
    editorFavoriteBtn?.addEventListener('click', toggleFavorite);
}

const USER_AI_FORM = {
    form: userAiSettingsForm,
    keyInput: userOpenrouterKey,
    modelInput: userOpenrouterModel,
    modelList: document.getElementById('userOpenrouterModelList'),
    keyStatus: userOpenrouterKeyStatus,
    summary: userAiSettingsSummary,
    testBtn: userTestAiBtn,
    removeBtn: userRemoveAiKeyBtn
};

const ADMIN_AI_FORM = {
    form: adminAiSettingsForm,
    keyInput: adminOpenrouterKey,
    modelInput: adminOpenrouterModel,
    modelList: document.getElementById('adminOpenrouterModelList'),
    keyStatus: adminOpenrouterKeyStatus,
    summary: adminAiSettingsSummary,
    testBtn: adminTestAiBtn,
    removeBtn: adminRemoveAiKeyBtn
};

function syncAiStateFromSettings(settings) {
    state.hasAiKey = !!settings?.has_api_key;
    state.aiModel = settings?.model || 'google/gemma-4-26b-a4b-it';
    updateEditorAiButtonState();
}

function populateAiModelField(formConfig, settings) {
    const input = formConfig.modelInput;
    const list = formConfig.modelList;
    if (!input) return;

    const models = settings?.suggested_models || settings?.available_models || {
        'google/gemma-4-26b-a4b-it': 'Gemma 4 26B (recommended)'
    };

    if (list) {
        list.innerHTML = Object.entries(models).map(([id, label]) =>
            `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`
        ).join('');
    }

    input.value = settings?.model || 'google/gemma-4-26b-a4b-it';
}

function renderAiSettingsForm(formConfig, settings) {
    populateAiModelField(formConfig, settings);

    if (formConfig.keyInput) {
        formConfig.keyInput.value = '';
        formConfig.keyInput.placeholder = settings?.has_api_key
            ? `Saved key ${settings.api_key_masked || ''} — enter a new key to replace`
            : 'sk-or-v1-…';
    }

    if (formConfig.keyStatus) {
        if (settings?.has_api_key) {
            formConfig.keyStatus.textContent = `Saved key: ${settings.api_key_masked || 'configured'}`;
            formConfig.keyStatus.classList.remove('hidden');
            formConfig.keyStatus.classList.add('is-set');
        } else {
            formConfig.keyStatus.textContent = 'No API key saved yet.';
            formConfig.keyStatus.classList.remove('hidden', 'is-set');
        }
    }

    syncAiStateFromSettings(settings);
}

async function fetchAiSettings() {
    const res = await apiFetch('api/settings.php?action=ai');
    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || 'Could not load AI settings.');
    }
    return data;
}

async function loadAiSettingsForm(formConfig) {
    if (!formConfig.form) return;

    try {
        const settings = await fetchAiSettings();
        renderAiSettingsForm(formConfig, settings);
    } catch (err) {
        if (formConfig.summary) {
            formConfig.summary.textContent = err.message;
            formConfig.summary.classList.remove('hidden');
        }
    }
}

async function saveAiSettingsForm(formConfig) {
    if (!formConfig.form) return;

    const payload = {
        model: formConfig.modelInput?.value.trim() || state.aiModel
    };
    const newKey = formConfig.keyInput?.value.trim();
    if (newKey) {
        payload.api_key = newKey;
    }

    try {
        const res = await apiFetch('api/settings.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error || 'Could not save AI settings.');
        }

        renderAiSettingsForm(formConfig, data.settings);
        await loadAiSettingsForm(formConfig === USER_AI_FORM ? ADMIN_AI_FORM : USER_AI_FORM);

        if (formConfig.summary) {
            formConfig.summary.textContent = 'AI settings saved.';
            formConfig.summary.classList.remove('hidden');
        }
    } catch (err) {
        await modalAlert(err.message, 'Save failed');
    }
}

async function testAiSettingsForm(formConfig) {
    const newKey = formConfig.keyInput?.value.trim();
    if (newKey) {
        await saveAiSettingsForm(formConfig);
    }

    if (!state.hasAiKey) {
        await modalAlert('Add and save your OpenRouter API key first.', 'Test connection');
        return;
    }

    if (formConfig.summary) {
        formConfig.summary.textContent = 'Testing OpenRouter connection…';
        formConfig.summary.classList.remove('hidden');
    }

    try {
        const res = await apiFetch('api/settings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test' })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error || 'Connection test failed.');
        }

        if (formConfig.summary) {
            formConfig.summary.textContent = `${data.message} (model: ${data.model})`;
            formConfig.summary.classList.remove('hidden');
        }
    } catch (err) {
        if (formConfig.summary) {
            formConfig.summary.textContent = err.message;
            formConfig.summary.classList.remove('hidden');
        }
        await modalAlert(err.message, 'Test failed');
    }
}

async function removeAiSettingsKey(formConfig) {
    const confirmed = await modalConfirm(
        'This will remove your saved OpenRouter API key from MyNotes.',
        'Remove API key',
        'Remove'
    );
    if (!confirmed) return;

    try {
        const res = await apiFetch('api/settings.php', { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error || 'Could not remove API key.');
        }

        renderAiSettingsForm(formConfig, data.settings);
        await loadAiSettingsForm(formConfig === USER_AI_FORM ? ADMIN_AI_FORM : USER_AI_FORM);

        if (formConfig.summary) {
            formConfig.summary.textContent = 'API key removed.';
            formConfig.summary.classList.remove('hidden');
        }
    } catch (err) {
        await modalAlert(err.message, 'Remove failed');
    }
}

function initAiSettings() {
    USER_AI_FORM.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAiSettingsForm(USER_AI_FORM);
    });
    ADMIN_AI_FORM.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAiSettingsForm(ADMIN_AI_FORM);
    });

    USER_AI_FORM.testBtn?.addEventListener('click', () => testAiSettingsForm(USER_AI_FORM));
    ADMIN_AI_FORM.testBtn?.addEventListener('click', () => testAiSettingsForm(ADMIN_AI_FORM));
    USER_AI_FORM.removeBtn?.addEventListener('click', () => removeAiSettingsKey(USER_AI_FORM));
    ADMIN_AI_FORM.removeBtn?.addEventListener('click', () => removeAiSettingsKey(ADMIN_AI_FORM));
}

function updateEditorAiButtonState() {
    if (!editorAiBtn) return;
    editorAiBtn.classList.toggle('is-ready', !!state.hasAiKey);
    editorAiBtn.title = state.hasAiKey
        ? `AI commands (${state.aiModel}) — Ctrl+Shift+A`
        : 'AI commands — add your OpenRouter key in Account settings';
}

function getAiCommand(id) {
    return AI_COMMANDS.find(cmd => cmd.id === id) || null;
}

function aiActionNeedsConfig(action) {
    const ui = getAiActionUi(action);
    return !!(ui.needsLang || ui.needsTopic || ui.needsQuestion || ui.needsPrompt || ui.usesScope);
}

function getDefaultAiApplyMode(action) {
    const ui = getAiActionUi(action);
    if (aiModalTarget?.mode === 'selection') return 'replace';
    if (ui.forceAppend) return 'append';
    return ui.defaultApply || 'replace';
}

function showAiPaletteView(view) {
    [aiPaletteViewCompose, aiPaletteViewPicker, aiPaletteViewConfig, aiPaletteViewLoading, aiPaletteViewResult].forEach(el => {
        el?.classList.toggle('hidden', el !== view);
    });
}

function closeAiPalette() {
    aiPaletteOverlay?.classList.add('hidden');
    aiPaletteOverlay?.setAttribute('aria-hidden', 'true');
    hideAiSelectionBar();
}

function renderAiPaletteSuggestionChips() {
    if (!aiPaletteSuggestionChips) return;
    aiPaletteSuggestionChips.innerHTML = AI_COMPOSE_SUGGESTIONS.map(text => `
        <button type="button" class="ai-palette-chip" data-text="${escapeHtml(text)}">${escapeHtml(text.trim())}…</button>
    `).join('');
    aiPaletteSuggestionChips.querySelectorAll('.ai-palette-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const text = chip.dataset.text || '';
            if (!aiPaletteComposeInput) return;
            aiPaletteComposeInput.value = text;
            aiPaletteComposeInput.focus();
            aiPaletteComposeInput.setSelectionRange(text.length, text.length);
        });
    });
}

function renderAiPaletteScopeBadge() {
    if (!aiPaletteScopeBadge) return;
    if (!aiModalTarget?.text) {
        aiPaletteScopeBadge.classList.add('hidden');
        aiPaletteScopeBadge.textContent = '';
        return;
    }
    aiPaletteScopeBadge.classList.remove('hidden');
    aiPaletteScopeBadge.textContent = aiModalTarget.mode === 'selection'
        ? `Selection · ${aiModalTarget.text.length.toLocaleString()} characters`
        : `Full note · ${aiModalTarget.text.length.toLocaleString()} characters`;
}

function filterAiCommands(query) {
    const q = query.trim().toLowerCase();
    const items = [];

    if (q.length >= 2) {
        items.push({
            id: '__custom__',
            label: `Ask: “${query.trim()}”`,
            desc: 'Custom AI request',
            icon: 'fa-sparkles',
            group: 'Quick ask',
            customQuery: query.trim()
        });
    }

    AI_COMMANDS.forEach(cmd => {
        if (!q) {
            items.push(cmd);
            return;
        }
        const haystack = [cmd.label, cmd.desc, cmd.group, ...(cmd.keywords || [])].join(' ').toLowerCase();
        if (haystack.includes(q) || cmd.id.includes(q)) {
            items.push(cmd);
        }
    });

    return items;
}

function renderAiPaletteList(items) {
    aiPaletteFilteredItems = items;
    if (aiPaletteHighlight >= items.length) aiPaletteHighlight = Math.max(0, items.length - 1);

    if (!items.length) {
        aiPaletteList.innerHTML = '<p class="ai-palette-info">No commands match your search.</p>';
        return;
    }

    let html = '';
    let lastGroup = null;
    items.forEach((cmd, index) => {
        if (cmd.group !== lastGroup) {
            lastGroup = cmd.group;
            html += `<div class="ai-palette-group-label">${escapeHtml(cmd.group)}</div>`;
        }
        const activeClass = index === aiPaletteHighlight ? ' is-active' : '';
        html += `
            <button type="button" class="ai-palette-item${activeClass}" role="option" aria-selected="${index === aiPaletteHighlight}" data-index="${index}" data-id="${escapeHtml(cmd.id)}">
                <span class="ai-palette-item-icon"><i class="fa-solid ${escapeHtml(cmd.icon)}"></i></span>
                <span class="ai-palette-item-copy">
                    <span class="ai-palette-item-label">${escapeHtml(cmd.label)}</span>
                    <span class="ai-palette-item-desc">${escapeHtml(cmd.desc)}</span>
                </span>
                ${index === aiPaletteHighlight ? '<span class="ai-palette-item-kbd">↵</span>' : ''}
            </button>
        `;
    });
    aiPaletteList.innerHTML = html;

    aiPaletteList.querySelectorAll('.ai-palette-item').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            aiPaletteHighlight = Number(btn.dataset.index);
            renderAiPaletteList(aiPaletteFilteredItems);
        });
        btn.addEventListener('click', () => {
            selectAiPaletteCommand(btn.dataset.id, btn.dataset.index);
        });
    });

    const activeEl = aiPaletteList.querySelector('.ai-palette-item.is-active');
    activeEl?.scrollIntoView({ block: 'nearest' });
}

function setAiPaletteApplyMode(mode) {
    aiPaletteForm.applyMode = mode;
    aiPaletteApplySegments?.querySelectorAll('.ai-palette-segment').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.apply === mode);
    });
}

function buildAiPaletteConfigFields(command) {
    if (!aiPaletteConfigBody) return;
    const action = command.id;
    const ui = getAiActionUi(action);
    let html = '';

    if (ui.usesScope) {
        const scopeId = getAiScopeIdForAction(action);
        const label = getAiScopeLabel(action, scopeId);
        html += `<div class="ai-palette-info">${scopeId
            ? `This will summarize all notes in “${escapeHtml(label)}” and save the result as a new note.`
            : 'Open a note inside the folder you want to summarize, or use the sidebar context menu.'}</div>`;
    } else if (ui.needsLang) {
        html += '<div class="ai-palette-field"><span class="ai-palette-field-label">Target language</span><div class="ai-palette-lang-grid" id="aiPaletteLangGrid">';
        AI_LANGUAGES.forEach(lang => {
            const active = lang === aiPaletteForm.targetLang ? ' is-active' : '';
            html += `<button type="button" class="ai-palette-lang-btn${active}" data-lang="${escapeHtml(lang)}">${escapeHtml(lang)}</button>`;
        });
        html += '</div></div>';
    } else if (ui.needsTopic) {
        html += `
            <div class="ai-palette-field">
                <label class="ai-palette-field-label" for="aiPaletteTopicInput">Topic</label>
                <textarea id="aiPaletteTopicInput" placeholder="What should the AI write about?">${escapeHtml(aiPaletteForm.topic)}</textarea>
            </div>`;
    } else if (ui.needsQuestion) {
        html += `
            <div class="ai-palette-field">
                <label class="ai-palette-field-label" for="aiPaletteQuestionInput">Your question</label>
                <textarea id="aiPaletteQuestionInput" placeholder="Ask anything about the note content…">${escapeHtml(aiPaletteForm.question)}</textarea>
            </div>`;
    } else if (ui.needsPrompt || action === 'custom') {
        html += `
            <div class="ai-palette-field">
                <label class="ai-palette-field-label" for="aiPalettePromptInput">Instructions</label>
                <textarea id="aiPalettePromptInput" placeholder="Describe exactly what you want…">${escapeHtml(aiPaletteForm.prompt)}</textarea>
            </div>`;
    }

    aiPaletteConfigBody.innerHTML = html;

    aiPaletteConfigBody.querySelector('#aiPaletteLangGrid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-lang]');
        if (!btn) return;
        aiPaletteForm.targetLang = btn.dataset.lang;
        buildAiPaletteConfigFields(command);
    });

    const focusInput = aiPaletteConfigBody.querySelector('textarea');
    focusInput?.focus();
    aiPaletteConfigBody.querySelectorAll('textarea').forEach(el => {
        el.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('aiPaletteGenerate')?.click();
            }
        });
    });
}

function showAiPaletteConfig(command) {
    aiPaletteForm.action = command.id === '__custom__' ? 'custom' : command.id;
    if (command.customQuery) {
        aiPaletteForm.prompt = command.customQuery;
        aiPaletteForm.topic = command.customQuery;
    }

    if (aiPaletteConfigIcon) {
        aiPaletteConfigIcon.innerHTML = `<i class="fa-solid ${escapeHtml(command.icon)}"></i>`;
    }
    if (aiPaletteConfigTitle) aiPaletteConfigTitle.textContent = command.label;
    if (aiPaletteConfigDesc) aiPaletteConfigDesc.textContent = command.desc;

    setAiPaletteApplyMode(getDefaultAiApplyMode(aiPaletteForm.action));

    const ui = getAiActionUi(aiPaletteForm.action);
    const showApply = !ui.applyTarget && !ui.forceAppend && aiModalTarget?.mode !== 'selection';
    aiPaletteApplyWrap?.classList.toggle('hidden', !showApply);

    buildAiPaletteConfigFields(command);
    showAiPaletteView(aiPaletteViewConfig);
}

function selectAiPaletteCommand(id, index) {
    const cmd = aiPaletteFilteredItems[Number(index)] || getAiCommand(id) || { id, label: 'Custom', desc: '', icon: 'fa-sparkles', group: 'Advanced' };
    if (cmd.id === '__custom__') {
        showAiPaletteConfig(cmd);
        return;
    }

    aiPaletteForm.action = cmd.id;
    aiPaletteForm.prompt = '';
    aiPaletteForm.topic = '';
    aiPaletteForm.question = '';
    setAiPaletteApplyMode(getDefaultAiApplyMode(cmd.id));

    if (aiActionNeedsConfig(cmd.id)) {
        showAiPaletteConfig(cmd);
        return;
    }

    runAiFromPalette();
}

function openAiPalettePicker() {
    if (aiPaletteSearch) aiPaletteSearch.value = '';
    aiPaletteHighlight = 0;
    renderAiPaletteScopeBadge();
    renderAiPaletteList(filterAiCommands(''));
    showAiPaletteView(aiPaletteViewPicker);
    requestAnimationFrame(() => aiPaletteSearch?.focus());
}

function openAiPaletteCompose() {
    if (aiPaletteComposeInput) aiPaletteComposeInput.value = '';
    renderAiPaletteSuggestionChips();
    showAiPaletteView(aiPaletteViewCompose);
    requestAnimationFrame(() => aiPaletteComposeInput?.focus());
}

function openAiPalette(options = {}) {
    const presetAction = options.presetAction || null;
    const scopeType = options.scopeType || null;
    const scopeId = options.scopeId || null;

    if (!state.hasAiKey) {
        modalConfirm(
            'Add your OpenRouter API key in Account settings to use AI in notes.',
            'OpenRouter not configured',
            'Open Account'
        ).then(confirmed => {
            if (confirmed) {
                userPanelBtn.click();
                loadAiSettingsForm(USER_AI_FORM);
            }
        });
        return;
    }

    aiModalPresetAction = presetAction;
    aiModalScopeInfo = scopeType && scopeId ? { type: scopeType, id: scopeId } : null;
    aiModalTarget = quill ? getAiTargetText() : { text: '', mode: 'document', range: null };

    const action = presetAction || 'improve';
    const fromFolderContext = !!getAiActionUi(action).usesScope && !!aiModalScopeInfo;

    if (!fromFolderContext && (!state.activePage || !quill)) {
        modalAlert('Open a note first, or right-click a folder in the sidebar for folder summaries.', 'No note open');
        return;
    }

    aiPaletteForm = {
        action: presetAction || 'improve',
        prompt: '',
        topic: '',
        question: '',
        targetLang: 'English',
        applyMode: 'replace',
        composeText: ''
    };
    aiModalResultText = '';
    aiModalApplyTarget = 'content';

    aiPaletteOverlay?.classList.remove('hidden');
    aiPaletteOverlay?.setAttribute('aria-hidden', 'false');

    const isEmptyNote = !aiModalTarget.text && !fromFolderContext;

    if (isEmptyNote) {
        openAiPaletteCompose();
        return;
    }

    if (presetAction) {
        const cmd = getAiCommand(presetAction);
        if (cmd && aiActionNeedsConfig(presetAction)) {
            showAiPaletteConfig(cmd);
        } else if (cmd) {
            aiPaletteForm.action = presetAction;
            setAiPaletteApplyMode(getDefaultAiApplyMode(presetAction));
            runAiFromPalette();
        } else {
            openAiPalettePicker();
        }
        return;
    }

    openAiPalettePicker();
}

function readAiPaletteConfigForm() {
    const topicEl = aiPaletteConfigBody?.querySelector('#aiPaletteTopicInput');
    const questionEl = aiPaletteConfigBody?.querySelector('#aiPaletteQuestionInput');
    const promptEl = aiPaletteConfigBody?.querySelector('#aiPalettePromptInput');
    if (topicEl) aiPaletteForm.topic = topicEl.value.trim();
    if (questionEl) aiPaletteForm.question = questionEl.value.trim();
    if (promptEl) aiPaletteForm.prompt = promptEl.value.trim();
}

async function runAiFromPalette() {
    if (!aiPaletteViewConfig?.classList.contains('hidden')) {
        readAiPaletteConfigForm();
    }

    let action = aiPaletteForm.action;
    let prompt = aiPaletteForm.prompt;
    let topic = aiPaletteForm.topic;
    const question = aiPaletteForm.question;
    const targetLang = aiPaletteForm.targetLang;
    const ui = getAiActionUi(action);
    const cmd = getAiCommand(action);

    if (action === 'custom' && !prompt) {
        return;
    }
    if (ui.needsTopic && !topic) return;
    if (ui.needsQuestion && !question) return;
    if (ui.usesScope && !getAiScopeIdForAction(action)) {
        await modalAlert('Could not determine which folder to summarize.', 'Folder required');
        return;
    }
    if (!aiModalTarget?.text && !actionAllowsEmptyNote(action) && action !== 'custom') {
        await modalAlert('Write or select some text in the note first.', 'Nothing to process');
        return;
    }

    if (aiPaletteLoadingText) aiPaletteLoadingText.textContent = 'Generating with AI…';
    if (aiPaletteLoadingAction) aiPaletteLoadingAction.textContent = cmd?.label || action;
    showAiPaletteView(aiPaletteViewLoading);

    try {
        const payload = {
            action,
            text: aiModalTarget?.text || '',
            prompt,
            topic,
            question,
            target_lang: targetLang,
            title: pageTitle?.value.trim() || ''
        };
        if (ui.usesScope) payload.scope_id = getAiScopeIdForAction(action);

        const res = await apiFetch('api/ai.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok || data.error) {
            if (data.needs_settings) {
                throw new Error(data.error + ' Open Account → AI (OpenRouter) to configure it.');
            }
            throw new Error(data.error || 'AI request failed.');
        }

        aiModalResultText = data.result || '';
        aiModalApplyTarget = data.apply_target || ui.applyTarget || 'content';
        if (aiPaletteResultTitle) {
            aiPaletteResultTitle.textContent = cmd?.label || 'Ready to apply';
        }
        if (aiPaletteResultText) aiPaletteResultText.value = aiModalResultText;
        const applyBtn = document.getElementById('aiPaletteApply');
        if (applyBtn) {
            applyBtn.textContent = aiModalApplyTarget === 'title' ? 'Apply title' : 'Apply to note';
        }
        showAiPaletteView(aiPaletteViewResult);
    } catch (err) {
        await modalAlert(err.message, 'AI failed');
        if (aiActionNeedsConfig(action)) {
            showAiPaletteConfig(cmd || { id: action, label: action, desc: '', icon: 'fa-sparkles', group: 'Advanced' });
        } else {
            openAiPalettePicker();
        }
    }
}

async function applyAiPaletteResult() {
    await applyAiResultToEditor();
    closeAiPalette();
}

function positionAiSelectionBar(range) {
    if (!aiSelectionBar || !quill || !state.hasAiKey || !range?.length) {
        hideAiSelectionBar();
        return;
    }
    const bounds = quill.getBounds(range.index, range.length);
    if (!bounds) return;
    const editorRect = quill.root.getBoundingClientRect();
    const left = editorRect.left + bounds.left + bounds.width / 2;
    const top = editorRect.top + bounds.top;
    aiSelectionBar.style.left = `${left}px`;
    aiSelectionBar.style.top = `${top}px`;
    aiSelectionBar.classList.remove('hidden');
}

function hideAiSelectionBar() {
    aiSelectionBar?.classList.add('hidden');
}

function initAiPalette() {
    renderAiPaletteSuggestionChips();

    aiPaletteOverlay?.addEventListener('click', (e) => {
        if (e.target === aiPaletteOverlay) closeAiPalette();
    });

    document.getElementById('aiPaletteClose')?.addEventListener('click', closeAiPalette);
    document.getElementById('aiPaletteComposeClose')?.addEventListener('click', closeAiPalette);
    document.getElementById('aiPaletteComposeCancel')?.addEventListener('click', closeAiPalette);
    document.getElementById('aiPaletteConfigClose')?.addEventListener('click', closeAiPalette);
    document.getElementById('aiPaletteResultClose')?.addEventListener('click', closeAiPalette);

    document.getElementById('aiPaletteComposeRun')?.addEventListener('click', () => {
        const text = aiPaletteComposeInput?.value.trim();
        if (!text) {
            aiPaletteComposeInput?.focus();
            return;
        }
        aiPaletteForm.action = 'custom';
        aiPaletteForm.prompt = text;
        aiPaletteForm.topic = text;
        aiPaletteForm.applyMode = 'replace';
        runAiFromPalette();
    });

    aiPaletteComposeInput?.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('aiPaletteComposeRun')?.click();
        }
    });

    aiPaletteSearch?.addEventListener('input', () => {
        aiPaletteHighlight = 0;
        renderAiPaletteList(filterAiCommands(aiPaletteSearch.value));
    });

    aiPaletteSearch?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            aiPaletteHighlight = Math.min(aiPaletteHighlight + 1, aiPaletteFilteredItems.length - 1);
            renderAiPaletteList(aiPaletteFilteredItems);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            aiPaletteHighlight = Math.max(aiPaletteHighlight - 1, 0);
            renderAiPaletteList(aiPaletteFilteredItems);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const item = aiPaletteFilteredItems[aiPaletteHighlight];
            if (item) selectAiPaletteCommand(item.id, aiPaletteHighlight);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeAiPalette();
        }
    });

    document.getElementById('aiPaletteBack')?.addEventListener('click', openAiPalettePicker);
    document.getElementById('aiPaletteTryAgain')?.addEventListener('click', openAiPalettePicker);

    document.getElementById('aiPaletteGenerate')?.addEventListener('click', () => {
        readAiPaletteConfigForm();
        runAiFromPalette();
    });

    aiPaletteApplySegments?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-apply]');
        if (!btn) return;
        setAiPaletteApplyMode(btn.dataset.apply);
    });

    document.getElementById('aiPaletteApply')?.addEventListener('click', applyAiPaletteResult);

    aiSelectionBar?.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (!state.activePage || !quill) return;
            aiModalTarget = getAiTargetText();
            if (!aiModalTarget.text) return;
            aiPaletteForm.action = action;
            setAiPaletteApplyMode(getDefaultAiApplyMode(action));
            if (aiActionNeedsConfig(action)) {
                aiPaletteOverlay?.classList.remove('hidden');
                showAiPaletteConfig(getAiCommand(action));
            } else {
                aiPaletteOverlay?.classList.remove('hidden');
                runAiFromPalette();
            }
        });
    });

    document.getElementById('aiSelectionMore')?.addEventListener('click', () => {
        openAiPalette();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aiPaletteOverlay && !aiPaletteOverlay.classList.contains('hidden')) {
            closeAiPalette();
        }
    });
}

function initAiSelectionTracking() {
    quill?.on('selection-change', (range, oldRange, source) => {
        if (source === 'silent') return;
        if (range && range.length > 0 && state.hasAiKey && state.activePage) {
            positionAiSelectionBar(range);
        } else {
            hideAiSelectionBar();
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (aiSelectionBar && !aiSelectionBar.contains(e.target)) {
            window.setTimeout(() => {
                const range = quill?.getSelection();
                if (!range?.length) hideAiSelectionBar();
            }, 0);
        }
    });
}

function getAiActionUi(action) {
    return AI_ACTION_UI[action] || {};
}

function getAiScopeIdForAction(action) {
    if (action === 'summarize_section') {
        return aiModalScopeInfo?.id
            || state.activePage?.section_id
            || state.activeSection
            || null;
    }
    if (action === 'summarize_notebook') {
        if (aiModalScopeInfo?.type === 'notebook') return aiModalScopeInfo.id;
        if (state.activePage?.section_id) {
            return findNotebookIdForSection(state.activePage.section_id);
        }
        if (state.activeSection) {
            return findNotebookIdForSection(state.activeSection);
        }
        return state.activeNotebook || null;
    }
    return null;
}

function getAiScopeLabel(action, scopeId) {
    if (!scopeId) return '';
    if (action === 'summarize_section') {
        for (const sections of Object.values(state.sectionsCache)) {
            const match = sections.find(s => s.id == scopeId);
            if (match) return match.name;
        }
        return 'subfolder';
    }
    if (action === 'summarize_notebook') {
        const match = state.notebooks.find(n => n.id == scopeId);
        return match?.name || 'folder';
    }
    return '';
}

function actionAllowsEmptyNote(action) {
    const ui = getAiActionUi(action);
    return !!ui.allowsEmptyNote || !!ui.usesScope;
}

function getAiTargetText() {
    const range = quill?.getSelection();
    if (range && range.length > 0) {
        return {
            text: quill.getText(range.index, range.length).trim(),
            mode: 'selection',
            range
        };
    }

    return {
        text: quill?.getText().trim() || '',
        mode: 'document',
        range: null
    };
}

function openAiAssistModal(options = {}) {
    openAiPalette(options);
}

function insertAiTextAtEnd(text) {
    const index = Math.max(0, quill.getLength() - 1);
    const prefix = quill.getText(0, index).trim() ? '\n\n' : '';
    quill.insertText(index, `${prefix}${text}`, 'user');
    quill.setSelection(index + prefix.length + text.length, 0);
}

function insertAiTextAtStart(text) {
    quill.insertText(0, `${text}\n\n`, 'user');
    quill.setSelection(0, 0);
}

async function createNoteWithAiContent(title, content) {
    let sectionId = null;

    if (aiModalScopeInfo?.type === 'section') {
        sectionId = aiModalScopeInfo.id;
    } else     if (aiModalScopeInfo?.type === 'notebook') {
        let sections = state.sectionsCache[aiModalScopeInfo.id];
        if (!sections) {
            sections = await apiFetch(`api/sections.php?notebook_id=${aiModalScopeInfo.id}`).then(r => r.json());
            state.sectionsCache[aiModalScopeInfo.id] = sections;
        }
        if (Array.isArray(sections) && sections.length > 0) {
            sectionId = sections[0].id;
        }
    }

    if (!sectionId && state.activePage?.section_id) {
        sectionId = state.activePage.section_id;
    }
    if (!sectionId && state.activeSection) {
        sectionId = state.activeSection;
    }

    if (!sectionId) {
        await modalAlert('Could not find a subfolder to save the summary note.', 'Save failed');
        return false;
    }

    const res = await apiFetch('api/pages.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, title, content: `<p>${escapeHtml(content).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` })
    });
    const data = await res.json();
    if (!data?.id) {
        await modalAlert('Could not create the summary note.', 'Save failed');
        return false;
    }

    if (!state.pagesCache[sectionId]) {
        await loadPagesForSection(sectionId);
    } else {
        state.pagesCache[sectionId].push({
            id: data.id,
            section_id: sectionId,
            title: data.title || title,
            is_favorite: 0
        });
    }

    await openPage(data.id);
    renderTree();
    return true;
}

async function applyAiResultToEditor() {
    const result = aiModalResultText.trim();
    if (!result) return;

    const action = aiPaletteForm.action || 'improve';
    const ui = getAiActionUi(action);

    if (aiModalApplyTarget === 'title') {
        if (pageTitle) {
            pageTitle.value = result.replace(/^["']|["']$/g, '').split('\n')[0].trim();
            scheduleSave();
        }
        return;
    }

    if (ui.usesScope && aiModalScopeInfo) {
        const scopeLabel = getAiScopeLabel(action, getAiScopeIdForAction(action));
        const noteTitle = action === 'summarize_section'
            ? `Summary: ${scopeLabel}`
            : `Summary: ${scopeLabel}`;
        await createNoteWithAiContent(noteTitle, result);
        return;
    }

    if (!quill || !aiModalTarget) return;

    const applyMode = ui.forceAppend
        ? 'append'
        : (aiModalTarget.mode === 'selection' ? 'replace' : (aiPaletteForm.applyMode || ui.defaultApply || 'replace'));

    if (aiModalTarget.range && aiModalTarget.range.length > 0) {
        quill.deleteText(aiModalTarget.range.index, aiModalTarget.range.length, 'user');
        quill.insertText(aiModalTarget.range.index, result, 'user');
        quill.setSelection(aiModalTarget.range.index + result.length, 0);
    } else if (applyMode === 'append' || action === 'continue') {
        insertAiTextAtEnd(result);
    } else if (applyMode === 'prepend') {
        insertAiTextAtStart(result);
    } else {
        quill.setText(result, 'user');
        quill.setSelection(quill.getLength(), 0);
    }

    scheduleSave();
    scheduleEditorStatsUpdate();
    scheduleEditorTocUpdate();
}

function setSaveStatus(status, label) {
    saveStatus.dataset.state = status;
    saveStatus.querySelector('.save-status-label').textContent = label;
    const icon = saveStatus.querySelector('i');
    const icons = {
        saved: 'fa-solid fa-check',
        saving: 'fa-solid fa-spinner fa-spin',
        uploading: 'fa-solid fa-cloud-arrow-up',
        error: 'fa-solid fa-circle-exclamation'
    };
    icon.className = icons[status] || icons.saved;
}

function formatRelativeTime(iso) {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function updateEditorMeta(page) {
    if (page?.updated_at) {
        editorMeta.textContent = `Edited ${formatRelativeTime(page.updated_at)}`;
        editorMeta.classList.remove('hidden');
    } else {
        editorMeta.classList.add('hidden');
    }
}

function updateBreadcrumb(page) {
    if (!page?.section_id) {
        editorBreadcrumb.innerHTML = '';
        return;
    }

    let notebookName = '';
    let sectionName = '';

    for (const nb of state.notebooks) {
        const sections = state.sectionsCache[nb.id] || [];
        const section = sections.find(s => s.id == page.section_id);
        if (section) {
            notebookName = nb.name;
            sectionName = section.name;
            break;
        }
    }

    if (!sectionName) {
        editorBreadcrumb.innerHTML = '';
        return;
    }

    editorBreadcrumb.innerHTML = `
        <i class="fa-solid fa-folder"></i>
        <span>${escapeHtml(notebookName)}</span>
        <span class="breadcrumb-sep">/</span>
        <i class="fa-solid fa-folder-tree"></i>
        <span>${escapeHtml(sectionName)}</span>
    `;
}

function updateThemeUI() {
    const isDark = document.body.classList.contains('dark');
    const iconClass = isDark ? 'fa-solid fa-sun theme-icon' : 'fa-solid fa-moon theme-icon';
    const label = isDark ? 'Light Mode' : 'Dark Mode';

    const icon = themeToggleBtn.querySelector('.theme-icon');
    const labelEl = themeToggleBtn.querySelector('.theme-label');
    if (icon) icon.className = iconClass;
    if (labelEl) labelEl.textContent = label;

    const railIcon = railThemeBtn?.querySelector('.rail-theme-icon');
    if (railIcon) {
        railIcon.className = isDark ? 'fa-solid fa-sun rail-theme-icon' : 'fa-solid fa-moon rail-theme-icon';
    }
    if (railThemeBtn) {
        railThemeBtn.dataset.tooltip = isDark ? 'Light mode' : 'Dark mode';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initModal();
    initQuill();
    initTreeEvents();
    initSidebar();
    initEditorShortcuts();
    initEditorEnhancements();
    initSearch();
    initEmptyState();
    initEditorFavorite();
    initAiSettings();
    initAiPalette();
    initSketchModal();
    initBackupControls();
    initAdminUserManagement();
    fetchCsrfToken().finally(() => checkAuth());

    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') document.body.classList.add('dark');
    updateThemeUI();
});

function initSidebar() {
    if (!dashboardLayout || !sidebarCollapseBtn || !sidebarExpandBtn) return;

    const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    setSidebarCollapsed(collapsed);

    sidebarCollapseBtn.addEventListener('click', () => setSidebarCollapsed(true));
    sidebarExpandBtn.addEventListener('click', () => setSidebarCollapsed(false));
    document.querySelector('.rail-btn-brand')?.addEventListener('click', () => setSidebarCollapsed(false));

    railNewNotebookBtn?.addEventListener('click', () => createNotebook());
    railThemeBtn?.addEventListener('click', () => themeToggleBtn.click());
    railAdminBtn?.addEventListener('click', () => adminPanelBtn.click());
    railLogoutBtn?.addEventListener('click', () => logoutBtn.click());
    sidebarFlyoutCloseBtn?.addEventListener('click', closeRailFlyout);
    sidebarNotesPanelCloseBtn?.addEventListener('click', () => {
        closeNotesPanel();
        renderTree();
    });

    railNotebooks?.addEventListener('click', handleRailClick);
    sidebarFlyoutBody?.addEventListener('click', handleFlyoutClick);
    railActiveNoteBtn?.addEventListener('click', async () => {
        const notebookId = getActiveNotebookId();
        if (notebookId) {
            await openRailFlyout(notebookId);
        } else {
            setSidebarCollapsed(false);
        }
    });
}

function setSidebarCollapsed(collapsed) {
    dashboardLayout.classList.toggle('sidebar-collapsed', collapsed);
    sidebarCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
    sidebarExpandBtn.setAttribute('aria-expanded', String(!collapsed));
    localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false');

    if (collapsed) {
        treeActiveSlider?.classList.remove('is-visible');
        renderRail();
        if (railFlyoutNotebookId) {
            renderRailFlyout();
        }
    } else {
        closeRailFlyout();
        syncNotesPanelLayout();
        renderSidebarNotesPanel();
        requestAnimationFrame(updateTreeActiveSlider);
    }
}

function getActiveNotebookId() {
    if (state.activePage?.section_id) {
        for (const nb of state.notebooks) {
            const sections = state.sectionsCache[nb.id] || [];
            if (sections.some(s => s.id == state.activePage.section_id)) {
                return nb.id;
            }
        }
    }
    return state.activeNotebook;
}

function syncRailAdminVisibility() {
    const isAdmin = !adminPanelBtn.classList.contains('hidden');
    railAdminBtn?.classList.toggle('hidden', !isAdmin);
}

function renderRail() {
    if (!railNotebooks) return;

    const activeNotebookId = getActiveNotebookId();

    if (state.notebooks.length === 0) {
        railNotebooks.innerHTML = '';
    } else {
        railNotebooks.innerHTML = state.notebooks.map(nb => {
            const isActive = activeNotebookId == nb.id;
            const initial = (nb.name || 'F').charAt(0).toUpperCase();
            return `
                <button
                    class="rail-btn rail-notebook-btn ${isActive ? 'is-active' : ''}"
                    type="button"
                    data-action="open-rail-flyout"
                    data-id="${nb.id}"
                    data-tooltip="${escapeHtml(nb.name)}"
                    aria-label="${escapeHtml(nb.name)}"
                >
                    <span class="rail-letter">${escapeHtml(initial)}</span>
                </button>
            `;
        }).join('');
    }

    if (state.activePage) {
        railActiveNoteBtn?.classList.remove('hidden');
        railActiveNoteBtn?.classList.toggle('is-active', !!railFlyoutNotebookId);
        const title = state.activePage.title || 'Untitled';
        railActiveNoteBtn.dataset.tooltip = title;
        railActiveNoteBtn.setAttribute('aria-label', title);
    } else {
        railActiveNoteBtn?.classList.add('hidden');
    }

    syncRailAdminVisibility();
}

async function handleRailClick(e) {
    const btn = e.target.closest('[data-action="open-rail-flyout"]');
    if (!btn) return;
    await openRailFlyout(btn.dataset.id);
}

async function openRailFlyout(notebookId) {
    const id = String(notebookId);

    if (railFlyoutNotebookId === id && !sidebarFlyout.classList.contains('hidden')) {
        closeRailFlyout();
        return;
    }

    railFlyoutNotebookId = id;
    if (!state.sectionsCache[notebookId]) {
        await loadSectionsForNotebook(notebookId);
    }

    const activeNotebookId = getActiveNotebookId();
    if (state.activePage?.section_id && String(activeNotebookId) === id) {
        await selectSection(state.activePage.section_id, notebookId, { toggle: false, forceOpen: true });
    } else if (state.selectedSection && String(state.selectedSection.notebookId) !== id) {
        state.selectedSection = null;
    }

    renderRail();
    renderRailFlyout();
    sidebarFlyout.classList.remove('hidden');
    dashboardLayout.classList.add('sidebar-flyout-open');
}

function closeRailFlyout() {
    railFlyoutNotebookId = null;
    sidebarFlyout?.classList.add('hidden');
    dashboardLayout?.classList.remove('sidebar-flyout-open');
    renderRail();
}

function syncNotesPanelLayout() {
    const open = !!state.selectedSection && !dashboardLayout?.classList.contains('sidebar-collapsed');
    dashboardLayout?.classList.toggle('sidebar-notes-panel-open', open);
    sidebarNotesPanel?.classList.toggle('hidden', !open);
}

async function selectSection(sectionId, notebookId, options = {}) {
    const { toggle = true, forceOpen = false } = options;
    const secId = Number(sectionId);
    const nbId = Number(notebookId);
    const panelOpen = !!state.selectedSection && !dashboardLayout?.classList.contains('sidebar-collapsed');

    if (panelOpen && state.selectedSection && !forceOpen) {
        const isSame = state.selectedSection.sectionId === secId && state.selectedSection.notebookId === nbId;

        if (isSame && toggle) {
            closeNotesPanel();
            renderTree();
            return;
        }

        if (!isSame) {
            closeNotesPanel();
            renderTree();
            return;
        }
    }

    state.selectedSection = { sectionId: secId, notebookId: nbId };
    state.activeSection = secId;
    state.activeNotebook = nbId;
    state.expanded.root = true;
    state.expanded.notebooks.add(String(nbId));

    if (!state.sectionsCache[nbId]) {
        await loadSectionsForNotebook(nbId);
    }
    if (!state.pagesCache[secId]) {
        await loadPagesForSection(secId);
    }

    syncNotesPanelLayout();
    renderTree();
}

function retractNotesPanelIfOpen() {
    if (!state.selectedSection) return false;
    closeNotesPanel();
    return true;
}

function closeNotesPanel() {
    state.selectedSection = null;
    syncNotesPanelLayout();
}

function getSelectedSectionMeta() {
    const selected = state.selectedSection;
    if (!selected) return null;

    const notebook = state.notebooks.find(n => n.id == selected.notebookId);
    const sections = state.sectionsCache[selected.notebookId] || [];
    const section = sections.find(s => s.id == selected.sectionId);

    return { selected, notebook, section };
}

function renderRailFlyout() {
    if (!railFlyoutNotebookId || !sidebarFlyoutBody || !sidebarFlyoutTitle) return;

    const notebook = state.notebooks.find(n => String(n.id) === String(railFlyoutNotebookId));
    if (!notebook) {
        closeRailFlyout();
        return;
    }

    const sections = state.sectionsCache[notebook.id] || [];
    const selected = state.selectedSection;
    const showingNotes = selected && String(selected.notebookId) === String(notebook.id);

    if (showingNotes) {
        const section = sections.find(s => s.id == selected.sectionId);
        const pages = state.pagesCache[selected.sectionId] || [];

        sidebarFlyoutTitle.textContent = section?.name || 'Subfolder';
        sidebarFlyoutBody.innerHTML = `
            <button class="flyout-action flyout-back" type="button" data-action="flyout-back-sections">
                <i class="fa-solid fa-arrow-left"></i>
                <span>All subfolders</span>
            </button>
            <div class="flyout-pages">
                ${renderSectionNotesList(pages, selected.sectionId, { variant: 'flyout' })}
            </div>
            <button class="flyout-action" type="button" data-action="create-page" data-id="${selected.sectionId}">
                <i class="fa-solid fa-file-circle-plus"></i>
                <span>New note</span>
            </button>
        `;
        return;
    }

    sidebarFlyoutTitle.textContent = notebook.name;

    if (sections.length === 0) {
        sidebarFlyoutBody.innerHTML = `
            <div class="flyout-empty">No subfolders yet</div>
            <button class="flyout-action" type="button" data-action="create-section" data-id="${notebook.id}">
                <i class="fa-solid fa-folder-plus"></i>
                <span>New subfolder</span>
            </button>
        `;
        return;
    }

    sidebarFlyoutBody.innerHTML = sections.map(sec => {
        const isSelected = selected?.sectionId == sec.id;
        const pages = state.pagesCache[sec.id];
        const countLabel = Array.isArray(pages) ? `<span class="tree-label-count">${pages.length}</span>` : '';

        return `
            <button
                class="flyout-section-header ${isSelected ? 'is-selected' : ''}"
                type="button"
                data-action="select-flyout-section"
                data-id="${sec.id}"
                data-notebook-id="${notebook.id}"
            >
                <i class="fa-solid fa-folder-tree"></i>
                <span>${escapeHtml(sec.name)}</span>${countLabel}
                <i class="fa-solid fa-chevron-right flyout-chevron"></i>
            </button>
        `;
    }).join('') + `
        <button class="flyout-action" type="button" data-action="create-section" data-id="${notebook.id}">
            <i class="fa-solid fa-folder-plus"></i>
            <span>New subfolder</span>
        </button>
    `;
}

async function handleFlyoutClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;

    switch (action) {
        case 'select-flyout-section':
            await selectSection(id, actionEl.dataset.notebookId, { toggle: false, forceOpen: true });
            renderRailFlyout();
            break;
        case 'flyout-back-sections':
            closeNotesPanel();
            renderRailFlyout();
            break;
        case 'open-page':
            if (e.target.closest('.flyout-page span')) {
                clearTimeout(flyoutPageClickTimer);
                flyoutPageClickTimer = setTimeout(async () => {
                    flyoutPageClickTimer = null;
                    if (!treeLabelEdit) {
                        await openPage(id);
                        renderRailFlyout();
                    }
                }, 280);
                break;
            }
            await openPage(id);
            renderRailFlyout();
            break;
        case 'create-section':
            await createSection(id);
            renderRailFlyout();
            break;
        case 'create-page':
            await createPage(id);
            renderRailFlyout();
            break;
    }
}

function initTreeEvents() {
    treeView.addEventListener('click', handleTreeClick);
    sidebarNotesPanelBody?.addEventListener('click', handleTreeClick);
    treeView.addEventListener('dblclick', handleTreeLabelDblClick);
    sidebarNotesPanelBody?.addEventListener('dblclick', handleTreeLabelDblClick);
    treeView.addEventListener('scroll', () => {
        updateTreeActiveSlider();
        hideTreeContextMenu();
    }, { passive: true });
    window.addEventListener('resize', updateTreeActiveSlider);
    initTreeContextMenu();
    initTreeRename();
    initTreeDragDrop();
}

function initTreeRename() {
    sidebarFlyout?.addEventListener('dblclick', handleFlyoutLabelDblClick);

    document.addEventListener('mousedown', (e) => {
        if (!treeLabelEdit) return;
        if (treeLabelEdit.input.contains(e.target)) return;
        if (e.target.closest('.tree-label-input, .flyout-label-input')) return;
        commitTreeLabelEdit();
    }, true);
}

let treeDragSource = null;
let treeDropIndicator = null;
let treeDragExpandTimer = null;
let treeDragNeedsRender = false;

function initTreeDragDrop() {
    treeView.addEventListener('mousedown', (e) => {
        if (e.target.closest('.tree-drag-handle')) {
            e.stopPropagation();
        }
    }, true);

    treeView.addEventListener('dragstart', handleTreeDragStart);
    treeView.addEventListener('dragend', handleTreeDragEnd);

    const onDragOver = (e) => handleTreeDragOver(e);
    const onDrop = (e) => handleTreeDrop(e);

    treeView.addEventListener('dragover', onDragOver);
    treeView.addEventListener('dragleave', handleTreeDragLeave);
    treeView.addEventListener('drop', onDrop);

    if (treeScrollArea) {
        treeScrollArea.addEventListener('dragover', onDragOver);
        treeScrollArea.addEventListener('drop', onDrop);
    }

    if (sidebarNotesPanelBody) {
        sidebarNotesPanelBody.addEventListener('mousedown', (e) => {
            if (e.target.closest('.tree-drag-handle')) {
                e.stopPropagation();
            }
        }, true);
        sidebarNotesPanelBody.addEventListener('dragstart', handleTreeDragStart);
        sidebarNotesPanelBody.addEventListener('dragend', handleTreeDragEnd);
        sidebarNotesPanelBody.addEventListener('dragover', onDragOver);
        sidebarNotesPanelBody.addEventListener('dragleave', handleTreeDragLeave);
        sidebarNotesPanelBody.addEventListener('drop', onDrop);
    }
}

function handleTreeDragStart(e) {
    const handle = e.target.closest('.tree-drag-handle');
    if (!handle || treeLabelEdit) {
        e.preventDefault();
        return;
    }

    const row = handle.closest('.tree-row');
    if (!row || row.classList.contains('tree-row-root')) {
        e.preventDefault();
        return;
    }

    treeDragNeedsRender = false;
    treeDragSource = {
        type: row.dataset.treeType,
        id: parseInt(row.dataset.treeId, 10),
        notebookId: row.dataset.treeNotebookId ? parseInt(row.dataset.treeNotebookId, 10) : null
    };

    row.classList.add('tree-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${treeDragSource.type}:${treeDragSource.id}`);

    if (e.dataTransfer.setDragImage) {
        const ghost = row.cloneNode(true);
        ghost.style.width = `${row.offsetWidth}px`;
        ghost.style.opacity = '0.85';
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.pointerEvents = 'none';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 20, 18);
        requestAnimationFrame(() => ghost.remove());
    }
}

function getTreeDropAction(source, targetRow, clientY) {
    const targetType = targetRow.dataset.treeType;
    if (!targetType || targetType === 'root' || !source) return null;

    const targetId = parseInt(targetRow.dataset.treeId, 10);
    if (source.type === targetType && source.id === targetId) return null;

    const rect = targetRow.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;

    if (source.type === 'notebook') {
        if (targetType !== 'notebook') return null;
        return {
            target_type: 'notebook',
            target_id: targetId,
            position: ratio < 0.5 ? 'before' : 'after'
        };
    }

    if (source.type === 'section') {
        if (targetType === 'notebook') {
            return { target_type: 'notebook', target_id: targetId, position: 'inside' };
        }
        if (targetType === 'section') {
            return {
                target_type: 'section',
                target_id: targetId,
                position: ratio < 0.5 ? 'before' : 'after'
            };
        }
        return null;
    }

    if (source.type === 'page') {
        if (targetType === 'notebook') {
            return { target_type: 'notebook', target_id: targetId, position: 'needs_subfolder' };
        }
        if (targetType === 'section') {
            return { target_type: 'section', target_id: targetId, position: 'inside' };
        }
        if (targetType === 'page') {
            return {
                target_type: 'page',
                target_id: targetId,
                position: ratio < 0.5 ? 'before' : 'after'
            };
        }
        return null;
    }

    return null;
}

function resolveTreeDrop(e) {
    if (!treeDragSource) return null;

    const row = e.target.closest('.tree-row');
    if (row && !row.classList.contains('tree-row-root')) {
        const action = getTreeDropAction(treeDragSource, row, e.clientY);
        if (action) {
            if (treeDragSource.type === 'section' && row.dataset.treeType === 'notebook') {
                scheduleNotebookExpandDuringDrag(parseInt(row.dataset.treeId, 10));
            }
            if (treeDragSource.type === 'page' && row.dataset.treeType === 'section') {
                scheduleSectionSelectDuringDrag(
                    parseInt(row.dataset.treeId, 10),
                    parseInt(row.dataset.treeNotebookId, 10)
                );
            }
            return {
                action,
                indicator: { kind: 'row', row, position: action.position }
            };
        }
    }

    if (treeDragSource.type === 'page') {
        const notebookEmpty = e.target.closest('.tree-children[data-context-notebook-id] .tree-empty');
        if (notebookEmpty) {
            const children = notebookEmpty.closest('.tree-children[data-context-notebook-id]');
            const notebookId = parseInt(children.dataset.contextNotebookId, 10);
            return {
                action: { target_type: 'notebook', target_id: notebookId, position: 'needs_subfolder' },
                indicator: { kind: 'container', el: children, style: 'needs_subfolder' }
            };
        }

        const notebookChildren = e.target.closest('.tree-children[data-context-notebook-id]');
        if (notebookChildren && !e.target.closest('.tree-row[data-tree-type="section"]')) {
            const notebookId = parseInt(notebookChildren.dataset.contextNotebookId, 10);
            return {
                action: { target_type: 'notebook', target_id: notebookId, position: 'needs_subfolder' },
                indicator: { kind: 'container', el: notebookChildren, style: 'needs_subfolder' }
            };
        }
    }

    if (treeDragSource.type === 'section') {
        const empty = e.target.closest('.tree-children[data-context-notebook-id] .tree-empty');
        if (empty) {
            const children = empty.closest('.tree-children[data-context-notebook-id]');
            const notebookId = parseInt(children.dataset.contextNotebookId, 10);
            scheduleNotebookExpandDuringDrag(notebookId);
            return {
                action: { target_type: 'notebook', target_id: notebookId, position: 'inside' },
                indicator: { kind: 'container', el: children }
            };
        }

        const children = e.target.closest('.tree-children[data-context-notebook-id]');
        if (children && !e.target.closest('.tree-row[data-tree-type="section"]')) {
            const notebookId = parseInt(children.dataset.contextNotebookId, 10);
            scheduleNotebookExpandDuringDrag(notebookId);
            return {
                action: { target_type: 'notebook', target_id: notebookId, position: 'inside' },
                indicator: { kind: 'container', el: children }
            };
        }
    }

    return null;
}

function scheduleNotebookExpandDuringDrag(notebookId) {
    if (treeDragSource?.type !== 'section') return;

    const key = String(notebookId);
    if (state.expanded.notebooks.has(key)) return;

    clearTreeDragExpandTimer();
    treeDragExpandTimer = setTimeout(async () => {
        treeDragExpandTimer = null;
        if (!treeDragSource) return;
        state.expanded.notebooks.add(key);
        if (!state.sectionsCache[notebookId]) {
            await loadSectionsForNotebook(notebookId);
        }
        treeDragNeedsRender = true;
    }, 650);
}

function scheduleSectionSelectDuringDrag(sectionId, notebookId) {
    if (treeDragSource?.type !== 'page') return;

    const secId = Number(sectionId);
    const nbId = Number(notebookId);
    if (state.selectedSection?.sectionId === secId && state.selectedSection?.notebookId === nbId) return;

    clearTreeDragExpandTimer();
    treeDragExpandTimer = setTimeout(async () => {
        treeDragExpandTimer = null;
        if (!treeDragSource) return;
        state.selectedSection = { sectionId: secId, notebookId: nbId };
        if (!state.pagesCache[secId]) {
            await loadPagesForSection(secId);
        }
        treeDragNeedsRender = true;
    }, 650);
}

function clearTreeDragExpandTimer() {
    if (treeDragExpandTimer) {
        clearTimeout(treeDragExpandTimer);
        treeDragExpandTimer = null;
    }
}

function clearTreeDropIndicators() {
    document.querySelectorAll('.tree-drop-before, .tree-drop-after, .tree-drop-inside, .tree-drop-needs-subfolder').forEach(el => {
        el.classList.remove('tree-drop-before', 'tree-drop-after', 'tree-drop-inside', 'tree-drop-needs-subfolder');
    });
    treeDropIndicator = null;
}

function setTreeDropIndicator(indicator) {
    if (!indicator) return;

    const current = treeDropIndicator;
    if (current?.kind === indicator.kind) {
        if (indicator.kind === 'row' && current.row === indicator.row && current.position === indicator.position) {
            return;
        }
        if (indicator.kind === 'container' && current.el === indicator.el && current.style === indicator.style) {
            return;
        }
    }

    clearTreeDropIndicators();
    treeDropIndicator = indicator;

    if (indicator.kind === 'row') {
        const className = indicator.position === 'needs_subfolder' ? 'tree-drop-needs-subfolder' : `tree-drop-${indicator.position}`;
        indicator.row.classList.add(className);
    } else {
        const className = indicator.style === 'needs_subfolder' ? 'tree-drop-needs-subfolder' : 'tree-drop-inside';
        indicator.el.classList.add(className);
    }
}

function handleTreeDragOver(e) {
    if (!treeDragSource) return;

    const inTree = treeView.contains(e.target)
        || treeScrollArea?.contains(e.target)
        || sidebarNotesPanelBody?.contains(e.target);
    if (!inTree) return;

    const resolved = resolveTreeDrop(e);
    if (resolved) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setTreeDropIndicator(resolved.indicator);
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    clearTreeDropIndicators();
}

function handleTreeDragLeave(e) {
    const related = e.relatedTarget;
    if (
        related
        && (treeView.contains(related) || treeScrollArea?.contains(related) || sidebarNotesPanelBody?.contains(related))
    ) return;
    clearTreeDropIndicators();
    clearTreeDragExpandTimer();
}

function buildTreeDropPayload(e, source) {
    const resolved = resolveTreeDrop(e);
    if (resolved) {
        return {
            type: source.type,
            id: source.id,
            target_type: resolved.action.target_type,
            target_id: resolved.action.target_id,
            position: resolved.action.position
        };
    }
    return null;
}

function handleTreeDrop(e) {
    const source = treeDragSource || parseTreeDragDataTransfer(e.dataTransfer);
    if (!source) return;

    e.preventDefault();
    e.stopPropagation();

    const payload = buildTreeDropPayload(e, source);

    clearTreeDropIndicators();
    clearTreeDragExpandTimer();
    treeDragSource = null;

    if (!payload) return;

    window.setTimeout(() => {
        processTreeDrop(payload).catch(err => console.error('Tree drop failed:', err));
    }, 0);
}

function parseTreeDragDataTransfer(dataTransfer) {
    try {
        const raw = dataTransfer?.getData('text/plain') || '';
        const [type, id] = raw.split(':');
        if (!type || !id) return null;
        return { type, id: parseInt(id, 10) };
    } catch {
        return null;
    }
}

async function processTreeDrop(payload) {
    if (payload.type === 'page' && payload.target_type === 'notebook' && payload.position === 'needs_subfolder') {
        try {
            await handlePageDropNeedsSubfolder(payload.target_id, payload.id);
        } catch (err) {
            await modalAlert(err.message || 'Could not move the note.', 'Move failed');
        }
        return;
    }

    try {
        await performTreeMove(payload);
    } catch (err) {
        await modalAlert(err.message || 'Could not move the item.', 'Move failed');
    }
}

function findPageTitle(pageId) {
    for (const pages of Object.values(state.pagesCache)) {
        const page = pages.find(p => p.id == pageId);
        if (page) return page.title || 'Untitled';
    }
    if (state.activePage?.id == pageId) return state.activePage.title || 'Untitled';
    return 'this note';
}

async function handlePageDropNeedsSubfolder(notebookId, pageId) {
    const notebook = state.notebooks.find(nb => nb.id == notebookId);
    const notebookName = notebook?.name || 'this folder';
    const pageTitle = findPageTitle(pageId);

    if (!state.sectionsCache[notebookId]) {
        await loadSectionsForNotebook(notebookId);
    }
    const sections = state.sectionsCache[notebookId] || [];

    const message = sections.length === 0
        ? `"${notebookName}" has no subfolders yet. Notes must live inside a subfolder. Create one and move "${pageTitle}" there?`
        : `Notes must be placed inside a subfolder. Create a new subfolder in "${notebookName}" and move "${pageTitle}" there?`;

    const confirmed = await modalConfirm(message, 'Subfolder required', 'Create subfolder');
    if (!confirmed) return;

    const name = await modalPrompt('New subfolder', 'Subfolder name');
    if (!name) return;

    const sectionId = await createSectionWithName(notebookId, name);
    if (!sectionId) return;

    await performTreeMove({
        type: 'page',
        id: pageId,
        target_type: 'section',
        target_id: sectionId,
        position: 'inside'
    });
}

function handleTreeDragEnd() {
    document.querySelectorAll('.tree-row.tree-dragging').forEach(el => el.classList.remove('tree-dragging'));
    treeDragSource = null;
    clearTreeDropIndicators();
    clearTreeDragExpandTimer();
    if (treeDragNeedsRender) {
        treeDragNeedsRender = false;
        renderTree();
    }
}

async function performTreeMove(payload) {
    const res = await apiFetch('api/tree_move.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Move failed');
    }

    await loadNotebooks(true);

    const notebookIds = new Set(data.affected_notebook_ids || []);
    for (const nbId of notebookIds) {
        await loadSectionsForNotebook(nbId);
    }

    const sectionIds = new Set(data.affected_section_ids || []);
    for (const secId of sectionIds) {
        await loadPagesForSection(secId);
    }

    if (payload.position === 'inside') {
        state.expanded.root = true;
        if (payload.target_type === 'notebook') {
            state.expanded.notebooks.add(String(payload.target_id));
        } else if (payload.target_type === 'section') {
            for (const nb of state.notebooks) {
                const sections = state.sectionsCache[nb.id] || [];
                if (sections.some(sec => sec.id == payload.target_id)) {
                    state.expanded.notebooks.add(String(nb.id));
                    state.selectedSection = { sectionId: payload.target_id, notebookId: nb.id };
                    break;
                }
            }
        }
    }

    if (payload.type === 'section') {
        state.expanded.root = true;
        if (data.new_notebook_id) {
            state.expanded.notebooks.add(String(data.new_notebook_id));
            state.activeNotebook = data.new_notebook_id;
        }
        if (payload.target_type === 'section') {
            for (const nb of state.notebooks) {
                const sections = state.sectionsCache[nb.id] || [];
                if (sections.some(sec => sec.id == payload.target_id || sec.id == payload.id)) {
                    state.expanded.notebooks.add(String(nb.id));
                }
                if (sections.some(sec => sec.id == payload.target_id)) {
                    state.selectedSection = { sectionId: payload.target_id, notebookId: nb.id };
                    break;
                }
            }
        }
    }

    if (payload.type === 'page') {
        state.expanded.root = true;
        let targetSectionId = data.new_section_id
            || (payload.target_type === 'section' ? payload.target_id : null);

        if (!targetSectionId && payload.target_type === 'page') {
            for (const [sectionId, pages] of Object.entries(state.pagesCache)) {
                if (pages.some(p => p.id == payload.target_id)) {
                    targetSectionId = parseInt(sectionId, 10);
                    break;
                }
            }
        }

        if (targetSectionId) {
            state.activeSection = targetSectionId;
            for (const nb of state.notebooks) {
                const sections = state.sectionsCache[nb.id] || [];
                if (sections.some(sec => sec.id == targetSectionId)) {
                    state.expanded.notebooks.add(String(nb.id));
                    state.activeNotebook = nb.id;
                    state.selectedSection = { sectionId: targetSectionId, notebookId: nb.id };
                    break;
                }
            }
        }
    }

    if (payload.type === 'page' && state.activePage?.id == payload.id && data.new_section_id) {
        state.activePage.section_id = data.new_section_id;
        state.activeSection = data.new_section_id;
    }

    if (payload.type === 'section' && state.activeSection == payload.id && data.new_notebook_id) {
        state.activeNotebook = data.new_notebook_id;
    }

    renderTree();
}

function initTreeContextMenu() {
    if (!treeContextMenu) return;

    treeContextMenu.addEventListener('click', handleTreeContextMenuClick);
    treeScrollArea?.addEventListener('contextmenu', handleTreeContextMenu);
    sidebarNotesPanelBody?.addEventListener('contextmenu', handleTreeContextMenu);
    sidebarFlyout?.addEventListener('contextmenu', handleFlyoutContextMenu);

    document.addEventListener('click', (e) => {
        if (treeContextMenu.contains(e.target)) return;
        hideTreeContextMenu();
    });
    document.addEventListener('contextmenu', (e) => {
        if (!treeContextMenu || treeContextMenu.classList.contains('hidden')) return;
        if (!treeContextMenu.contains(e.target)) {
            hideTreeContextMenu();
        }
    }, true);
    document.addEventListener('scroll', hideTreeContextMenu, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideTreeContextMenu();
    });
}

function hideTreeContextMenu() {
    if (!treeContextMenu || treeContextMenu.classList.contains('hidden')) return;
    treeContextMenu.classList.add('hidden');
    treeContextMenu.setAttribute('aria-hidden', 'true');
    treeContextMenu.innerHTML = '';
}

function showTreeContextMenu(x, y, items) {
    if (!treeContextMenu || items.length === 0) return;

    treeContextMenu.innerHTML = items.map(item => {
        if (item.divider) {
            return '<div class="tree-context-menu-divider" role="separator"></div>';
        }
        const dangerClass = item.danger ? ' is-danger' : '';
        const idAttr = item.id != null ? ` data-id="${escapeHtml(String(item.id))}"` : '';
        const typeAttr = item.type ? ` data-type="${escapeHtml(item.type)}"` : '';
        const sectionIdAttr = item.sectionId != null ? ` data-section-id="${escapeHtml(String(item.sectionId))}"` : '';
        return `
            <button
                type="button"
                class="tree-context-menu-item${dangerClass}"
                role="menuitem"
                data-action="${escapeHtml(item.action)}"${idAttr}${typeAttr}${sectionIdAttr}
            >
                <i class="fa-solid ${escapeHtml(item.icon)}"></i>
                <span>${escapeHtml(item.label)}</span>
            </button>
        `;
    }).join('');

    treeContextMenu.classList.remove('hidden');
    treeContextMenu.setAttribute('aria-hidden', 'false');
    treeContextMenu.style.left = `${x}px`;
    treeContextMenu.style.top = `${y}px`;

    requestAnimationFrame(() => {
        const rect = treeContextMenu.getBoundingClientRect();
        const padding = 8;
        let left = x;
        let top = y;

        if (left + rect.width > window.innerWidth - padding) {
            left = Math.max(padding, window.innerWidth - rect.width - padding);
        }
        if (top + rect.height > window.innerHeight - padding) {
            top = Math.max(padding, window.innerHeight - rect.height - padding);
        }

        treeContextMenu.style.left = `${left}px`;
        treeContextMenu.style.top = `${top}px`;
    });
}

function buildTreeContextMenuItems(target) {
    const aiItems = [];
    if (state.hasAiKey) {
        if (['section', 'section-empty'].includes(target.type)) {
            aiItems.push(
                { divider: true },
                { action: 'ai-summarize-section', id: target.id, label: 'AI summarize subfolder', icon: 'fa-wand-magic-sparkles' }
            );
        }
        if (['notebook', 'notebook-empty'].includes(target.type)) {
            aiItems.push(
                { divider: true },
                { action: 'ai-summarize-notebook', id: target.id, label: 'AI summarize folder', icon: 'fa-wand-magic-sparkles' }
            );
        }
    }

    const folderActions = (type, id) => [
        { divider: true },
        { action: 'rename', type, id, label: 'Rename', icon: 'fa-pen' },
        { action: 'delete', type, id, label: 'Delete', icon: 'fa-trash-can', danger: true }
    ];

    switch (target.type) {
        case 'root':
            return [{ action: 'create-notebook', label: 'New folder', icon: 'fa-folder-plus' }];
        case 'notebook':
        case 'notebook-empty':
            return [
                { action: 'create-section', id: target.id, label: 'New subfolder', icon: 'fa-folder-plus' },
                ...folderActions('notebook', target.id),
                ...aiItems
            ];
        case 'section':
        case 'section-empty':
            return [
                { action: 'create-page', id: target.id, label: 'New note', icon: 'fa-file-circle-plus' },
                ...folderActions('section', target.id),
                ...aiItems
            ];
        case 'page':
            return [
                { action: 'create-page', id: target.sectionId, label: 'New note', icon: 'fa-file-circle-plus' },
                { divider: true },
                isPageStarred(target.id)
                    ? { action: 'unstar', type: 'page', id: target.id, label: 'Remove from Starred', icon: 'fa-star' }
                    : { action: 'star', type: 'page', id: target.id, label: 'Add to Starred', icon: 'fa-star' },
                { divider: true },
                { action: 'rename', type: 'page', id: target.id, sectionId: target.sectionId, label: 'Rename', icon: 'fa-pen' },
                { action: 'duplicate', type: 'page', id: target.id, sectionId: target.sectionId, label: 'Duplicate', icon: 'fa-copy' },
                { divider: true },
                { action: 'delete', type: 'page', id: target.id, label: 'Delete', icon: 'fa-trash-can', danger: true }
            ];
        default:
            return [];
    }
}

function resolveTreeContextTarget(e) {
    const panelRow = e.target.closest('#sidebarNotesPanelBody .tree-row[data-tree-type="page"]');
    if (panelRow) {
        return {
            type: 'page',
            id: panelRow.dataset.treeId,
            sectionId: panelRow.dataset.treeSectionId
        };
    }

    if (e.target.closest('#sidebarNotesPanelBody') && state.selectedSection) {
        return { type: 'section-empty', id: state.selectedSection.sectionId };
    }

    const row = e.target.closest('.tree-row');
    if (row) {
        if (row.classList.contains('tree-row-root') || row.dataset.treeType === 'root') {
            return { type: 'root' };
        }

        const treeType = row.dataset.treeType;
        if (treeType === 'notebook') {
            return { type: 'notebook', id: row.dataset.treeId };
        }
        if (treeType === 'section') {
            return { type: 'section', id: row.dataset.treeId };
        }
        if (treeType === 'page' || treeType === 'starred-page') {
            return { type: 'page', id: row.dataset.treeId, sectionId: row.dataset.treeSectionId };
        }

        const createSectionBtn = row.querySelector('[data-action="create-section"]');
        if (createSectionBtn) {
            return { type: 'notebook', id: createSectionBtn.dataset.id };
        }
        const createPageBtn = row.querySelector('[data-action="create-page"]');
        if (createPageBtn) {
            return { type: 'section', id: createPageBtn.dataset.id };
        }
        if (row.dataset.action === 'open-page') {
            const sectionId = row.dataset.treeSectionId || state.selectedSection?.sectionId;
            if (sectionId) {
                return { type: 'page', id: row.dataset.id, sectionId };
            }
        }
    }

    const empty = e.target.closest('.tree-empty');
    if (empty) {
        const children = empty.closest('.tree-children');
        if (children?.dataset.contextSectionId) {
            return { type: 'section-empty', id: children.dataset.contextSectionId };
        }
        if (children?.dataset.contextNotebookId) {
            return { type: 'notebook-empty', id: children.dataset.contextNotebookId };
        }
        return { type: 'root' };
    }

    const children = e.target.closest('.tree-children');
    if (children && e.target === children) {
        if (children.dataset.contextSectionId) {
            return { type: 'section-empty', id: children.dataset.contextSectionId };
        }
        if (children.dataset.contextNotebookId) {
            return { type: 'notebook-empty', id: children.dataset.contextNotebookId };
        }
        return { type: 'root' };
    }

    if (e.target.closest('#treeView') || e.target.closest('.tree-scroll-area')) {
        return { type: 'root' };
    }

    return null;
}

function handleTreeContextMenu(e) {
    if (e.target.closest('.tree-action')) return;

    const target = resolveTreeContextTarget(e);
    if (!target) return;

    const items = buildTreeContextMenuItems(target);
    if (items.length === 0) return;

    e.preventDefault();
    e.stopPropagation();
    showTreeContextMenu(e.clientX, e.clientY, items);
}

function resolveFlyoutContextTarget(e) {
    if (!railFlyoutNotebookId || sidebarFlyout?.classList.contains('hidden')) return null;

    const page = e.target.closest('.flyout-page');
    if (page) {
        const sectionId = state.selectedSection?.sectionId;
        return page.dataset.id && sectionId
            ? { type: 'page', id: page.dataset.id, sectionId }
            : null;
    }

    const sectionHeader = e.target.closest('.flyout-section-header');
    if (sectionHeader) {
        return { type: 'section', id: sectionHeader.dataset.id };
    }

    const empty = e.target.closest('.flyout-empty');
    if (empty && state.selectedSection) {
        return { type: 'section-empty', id: state.selectedSection.sectionId };
    }

    if (e.target.closest('#sidebarFlyoutBody') || e.target.closest('.sidebar-flyout-header')) {
        return { type: 'notebook-empty', id: railFlyoutNotebookId };
    }

    return null;
}

function handleFlyoutContextMenu(e) {
    if (e.target.closest('.flyout-action')) return;

    const target = resolveFlyoutContextTarget(e);
    if (!target) return;

    const items = buildTreeContextMenuItems(target);
    if (items.length === 0) return;

    e.preventDefault();
    e.stopPropagation();
    showTreeContextMenu(e.clientX, e.clientY, items);
}

async function handleTreeContextMenuClick(e) {
    const item = e.target.closest('[data-action]');
    if (!item || !treeContextMenu.contains(item)) return;

    e.preventDefault();
    e.stopPropagation();
    hideTreeContextMenu();

    const action = item.dataset.action;
    const id = item.dataset.id;

    switch (action) {
        case 'create-notebook':
            await createNotebook();
            break;
        case 'create-section':
            await createSection(id);
            if (railFlyoutNotebookId) renderRailFlyout();
            break;
        case 'create-page':
            await createPage(id);
            if (railFlyoutNotebookId) renderRailFlyout();
            break;
        case 'ai-summarize-section':
            openAiAssistModal({ presetAction: 'summarize_section', scopeType: 'section', scopeId: Number(id) });
            break;
        case 'ai-summarize-notebook':
            openAiAssistModal({ presetAction: 'summarize_notebook', scopeType: 'notebook', scopeId: Number(id) });
            break;
        case 'rename':
            triggerTreeItemRename(item.dataset.type, id, item.dataset.sectionId || null);
            break;
        case 'duplicate':
            if (item.dataset.type === 'page') {
                await duplicatePage(id, item.dataset.sectionId);
            }
            break;
        case 'star':
            await setPageFavorite(id, true);
            break;
        case 'unstar':
            await setPageFavorite(id, false);
            break;
        case 'delete':
            await deleteItem(item.dataset.type, id);
            break;
    }
}

function updateTreeActiveSlider() {
    if (!treeActiveSlider || !treeScrollArea) return;

    const activeRow = treeView.querySelector('.tree-row.active:not(.tree-row-root)');
    const selectedRow = treeView.querySelector('.tree-row.is-selected');
    const highlightRow = activeRow || selectedRow;
    if (!highlightRow) {
        treeActiveSlider.classList.remove('is-visible');
        return;
    }

    const areaRect = treeScrollArea.getBoundingClientRect();
    const rowRect = highlightRow.getBoundingClientRect();
    const top = rowRect.top - areaRect.top;
    const height = rowRect.height;

    treeActiveSlider.style.transform = `translateY(${top}px)`;
    treeActiveSlider.style.height = `${height}px`;
    treeActiveSlider.classList.add('is-visible');
}

function scrollActiveTreeRowIntoView() {
    const selectedRow = state.selectedSection
        ? treeView.querySelector(`.tree-row[data-tree-type="section"][data-tree-id="${state.selectedSection.sectionId}"]`)
        : null;
    selectedRow?.scrollIntoView({ block: 'nearest', behavior: 'auto' });

    const activeNote = sidebarNotesPanelBody?.querySelector('.tree-row.active');
    activeNote?.scrollIntoView({ block: 'nearest', behavior: 'auto' });

    const activeStarred = treeView.querySelector('.tree-row.active:not(.tree-row-root)');
    if (!selectedRow && activeStarred) {
        activeStarred.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    updateTreeActiveSlider();
}

async function handleTreeClick(e) {
    if (!e.target.closest('.tree-action, .tree-toggle, .tree-drag-handle')) {
        const row = e.target.closest('.tree-row');
        if (row) {
            const treeType = row.dataset.treeType;
            const treeId = row.dataset.treeId;

            switch (treeType) {
                case 'root':
                    retractNotesPanelIfOpen();
                    state.expanded.root = !state.expanded.root;
                    renderTree();
                    return;
                case 'starred-root':
                    retractNotesPanelIfOpen();
                    state.expanded.starred = state.expanded.starred === false;
                    renderTree();
                    return;
                case 'notebook':
                    if (treeId) {
                        await toggleNotebook(treeId);
                    }
                    return;
                default:
                    break;
            }
        }
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    e.stopPropagation();
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;

    switch (action) {
        case 'toggle-starred':
            retractNotesPanelIfOpen();
            state.expanded.starred = state.expanded.starred === false;
            renderTree();
            break;
        case 'toggle-root':
            retractNotesPanelIfOpen();
            state.expanded.root = !state.expanded.root;
            renderTree();
            break;
        case 'toggle-notebook':
            toggleNotebook(id);
            break;
        case 'select-section': {
            const row = actionEl.closest('.tree-row');
            const notebookId = row?.dataset.treeNotebookId || id;
            await selectSection(id, notebookId);
            break;
        }
        case 'create-notebook':
            createNotebook();
            break;
        case 'create-section':
            createSection(id);
            break;
        case 'create-page':
            createPage(id);
            break;
        case 'toggle-favorite':
            toggleFavoriteForPage(id);
            break;
        case 'open-page':
            if (e.target.closest('.tree-label')) {
                clearTimeout(pageLabelClickTimer);
                pageLabelClickTimer = setTimeout(() => {
                    pageLabelClickTimer = null;
                    if (!treeLabelEdit) openPage(id);
                }, 280);
                break;
            }
            openPage(id);
            break;
        case 'delete':
            deleteItem(actionEl.dataset.type, id, e);
            break;
    }
}

function handleTreeLabelDblClick(e) {
    if (e.target.closest('.tree-action, .tree-toggle, .tree-drag-handle')) return;

    const label = e.target.closest('.tree-label');
    if (!label) return;

    const row = label.closest('.tree-row');
    if (!row || row.classList.contains('tree-row-root')) return;

    const type = row.dataset.treeType === 'starred-page' ? 'page' : row.dataset.treeType;
    const id = row.dataset.treeId;
    if (!type || !id || type === 'root') return;

    clearTimeout(pageLabelClickTimer);
    pageLabelClickTimer = null;

    e.preventDefault();
    e.stopPropagation();
    startInlineRename({
        anchorEl: label,
        type,
        id,
        value: label.textContent,
        sectionId: row.dataset.treeSectionId || null
    });
}

function handleFlyoutLabelDblClick(e) {
    if (e.target.closest('.flyout-action, .flyout-chevron')) return;

    const pageBtn = e.target.closest('.flyout-page');
    if (pageBtn) {
        const label = pageBtn.querySelector('span');
        if (!label || !pageBtn.dataset.id) return;
        clearTimeout(flyoutPageClickTimer);
        flyoutPageClickTimer = null;
        e.preventDefault();
        e.stopPropagation();
        startInlineRename({
            anchorEl: label,
            type: 'page',
            id: pageBtn.dataset.id,
            value: label.textContent,
            sectionId: state.selectedSection?.sectionId || null,
            inputClass: 'flyout-label-input'
        });
        return;
    }

    const sectionHeader = e.target.closest('.flyout-section-header');
    if (!sectionHeader || !sectionHeader.dataset.id) return;

    const label = sectionHeader.querySelector('span');
    if (!label) return;

    e.preventDefault();
    e.stopPropagation();
    startInlineRename({
        anchorEl: label,
        type: 'section',
        id: sectionHeader.dataset.id,
        value: label.textContent,
        inputClass: 'flyout-label-input'
    });
}

function triggerTreeItemRename(type, id, sectionId = null) {
    const row = treeView?.querySelector(`.tree-row[data-tree-type="${type}"][data-tree-id="${id}"]`)
        || sidebarNotesPanelBody?.querySelector(`.tree-row[data-tree-type="${type}"][data-tree-id="${id}"]`);
    if (row) {
        const label = row.querySelector('.tree-label');
        if (label) {
            startInlineRename({
                anchorEl: label,
                type,
                id,
                value: label.textContent,
                sectionId: sectionId || row.dataset.treeSectionId || null
            });
            return;
        }
    }

    if (type === 'page' && sidebarFlyoutBody) {
        const pageBtn = sidebarFlyoutBody.querySelector(`.flyout-page[data-id="${id}"]`);
        const label = pageBtn?.querySelector('span');
        if (label) {
            startInlineRename({
                anchorEl: label,
                type,
                id,
                value: label.textContent,
                sectionId: sectionId || state.selectedSection?.sectionId || null,
                inputClass: 'flyout-label-input'
            });
            return;
        }
    }

    if (type === 'section' && sidebarFlyoutBody) {
        const header = sidebarFlyoutBody.querySelector(`.flyout-section-header[data-id="${id}"]`);
        const label = header?.querySelector('span');
        if (label) {
            startInlineRename({
                anchorEl: label,
                type,
                id,
                value: label.textContent,
                inputClass: 'flyout-label-input'
            });
        }
    }
}

async function duplicatePage(pageId, sectionId) {
    const resolvedSectionId = sectionId || Object.keys(state.pagesCache).find(secId =>
        state.pagesCache[secId]?.some(p => p.id == pageId)
    );

    if (!resolvedSectionId) {
        await modalAlert('Could not find where this note belongs.', 'Duplicate failed');
        return;
    }

    const res = await apiFetch(`api/pages.php?page_id=${pageId}`);
    const page = await res.json();
    if (!page?.id) {
        await modalAlert('Could not load the note to duplicate.', 'Duplicate failed');
        return;
    }

    const baseTitle = (page.title || 'Untitled').trim();
    const title = / \(copy\)$/i.test(baseTitle) ? baseTitle : `${baseTitle} (copy)`;

    const createRes = await apiFetch('api/pages.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            section_id: resolvedSectionId,
            title,
            content: page.content || ''
        })
    });
    const data = await createRes.json();
    if (!data?.id) {
        await modalAlert('Could not duplicate the note.', 'Duplicate failed');
        return;
    }

    if (!state.pagesCache[resolvedSectionId]) {
        await loadPagesForSection(resolvedSectionId);
    } else {
        const sourceIndex = state.pagesCache[resolvedSectionId].findIndex(p => p.id == pageId);
        const newPage = {
            id: data.id,
            section_id: resolvedSectionId,
            title: data.title || title,
            is_favorite: 0,
            updated_at: new Date().toISOString()
        };
        if (sourceIndex >= 0) {
            state.pagesCache[resolvedSectionId].splice(sourceIndex + 1, 0, newPage);
        } else {
            state.pagesCache[resolvedSectionId].unshift(newPage);
        }
    }

    const notebookId = findNotebookIdForSection(resolvedSectionId);
    if (notebookId) {
        state.selectedSection = { sectionId: resolvedSectionId, notebookId };
    }
    if (railFlyoutNotebookId) renderRailFlyout();
    await openPage(data.id);
}

function startInlineRename({ anchorEl, type, id, value, sectionId = null, inputClass = 'tree-label-input' }) {
    cancelTreeLabelEdit();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = inputClass;
    input.value = value;
    input.setAttribute('aria-label', 'Rename item');

    anchorEl.replaceWith(input);

    treeLabelEdit = {
        input,
        type,
        id,
        originalValue: value,
        sectionId,
        labelClass: anchorEl.className || 'tree-label'
    };

    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            e.preventDefault();
            commitTreeLabelEdit();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelTreeLabelEdit();
        }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (treeLabelEdit?.input !== input) return;
            input.focus({ preventScroll: true });
            input.select();
        });
    });
}

function restoreTreeLabelEdit(edit) {
    const row = treeView.querySelector(`.tree-row[data-tree-type="${edit.type}"][data-tree-id="${edit.id}"]`);
    if (!row) return;

    const anchor = row.querySelector('.tree-label');
    if (!anchor) return;

    startInlineRename({
        anchorEl: anchor,
        type: edit.type,
        id: edit.id,
        value: edit.value,
        sectionId: edit.sectionId || row.dataset.treeSectionId || null,
        inputClass: edit.inputClass
    });
}

function restoreFlyoutLabelEdit(edit) {
    if (!sidebarFlyoutBody) return;

    if (edit.type === 'page') {
        const pageBtn = sidebarFlyoutBody.querySelector(`.flyout-page[data-id="${edit.id}"]`);
        const anchor = pageBtn?.querySelector('span');
        if (!anchor) return;

        startInlineRename({
            anchorEl: anchor,
            type: edit.type,
            id: edit.id,
            value: edit.value,
            sectionId: edit.sectionId || pageBtn.closest('.flyout-section')?.dataset.sectionId || null,
            inputClass: edit.inputClass
        });
        return;
    }

    if (edit.type === 'section') {
        const sectionHeader = sidebarFlyoutBody.querySelector(`.flyout-section-header[data-id="${edit.id}"]`);
        const anchor = sectionHeader?.querySelector('span');
        if (!anchor) return;

        startInlineRename({
            anchorEl: anchor,
            type: edit.type,
            id: edit.id,
            value: edit.value,
            inputClass: edit.inputClass
        });
    }
}

function isFlyoutLabelEdit(edit) {
    return edit?.inputClass?.includes('flyout');
}

function restoreInlineLabel(text) {
    if (!treeLabelEdit) return;
    const { input, labelClass } = treeLabelEdit;
    const label = document.createElement('span');
    label.className = labelClass;
    label.textContent = text;
    input.replaceWith(label);
    treeLabelEdit = null;
}

function cancelTreeLabelEdit() {
    if (!treeLabelEdit) return;
    restoreInlineLabel(treeLabelEdit.originalValue);
}

async function commitTreeLabelEdit() {
    if (!treeLabelEdit) return;

    const { input, type, id, originalValue, sectionId, labelClass } = treeLabelEdit;
    const trimmed = input.value.trim();

    if (!trimmed || trimmed === originalValue) {
        cancelTreeLabelEdit();
        return;
    }

    treeLabelEdit = null;

    let success = false;
    if (type === 'notebook') success = await renameNotebook(id, trimmed);
    else if (type === 'section') success = await renameSection(id, trimmed);
    else if (type === 'page') success = await renamePage(id, trimmed, sectionId);

    if (success) {
        renderTree();
        if (railFlyoutNotebookId) renderRailFlyout();
    } else {
        const label = document.createElement('span');
        label.className = labelClass;
        label.textContent = originalValue;
        input.replaceWith(label);
        await modalAlert('Could not rename item. Please try again.');
    }
}

async function renameNotebook(id, name) {
    const res = await apiFetch('api/notebooks.php', {
        method: 'PUT',
        body: JSON.stringify({ id, name })
    });
    if (!res.ok) return false;

    const notebook = state.notebooks.find(n => n.id == id);
    if (notebook) notebook.name = name;
    return true;
}

async function renameSection(id, name) {
    const res = await apiFetch('api/sections.php', {
        method: 'PUT',
        body: JSON.stringify({ id, name })
    });
    if (!res.ok) return false;

    for (const notebookId of Object.keys(state.sectionsCache)) {
        const section = state.sectionsCache[notebookId]?.find(s => s.id == id);
        if (section) {
            section.name = name;
            break;
        }
    }
    return true;
}

async function renamePage(id, title, sectionId) {
    const res = await apiFetch('api/pages.php', {
        method: 'PUT',
        body: JSON.stringify({ id, title })
    });
    if (!res.ok) return false;

    const resolvedSectionId = sectionId || findSectionIdForPage(id);
    const pages = resolvedSectionId ? state.pagesCache[resolvedSectionId] : null;
    if (pages) {
        const page = pages.find(p => p.id == id);
        if (page) page.title = title;
    }

    if (state.activePage?.id == id) {
        state.activePage.title = title;
        pageTitle.value = title;
        updateEditorMeta(state.activePage);
    }

    const starred = state.starredPages.find(p => p.id == id);
    if (starred) starred.title = title;

    return true;
}

function findSectionIdForPage(pageId) {
    for (const sectionId of Object.keys(state.pagesCache)) {
        if (state.pagesCache[sectionId]?.some(p => p.id == pageId)) {
            return sectionId;
        }
    }
    return state.activePage?.section_id || state.activeSection || null;
}

function initEditorShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (state.activePage) {
                clearTimeout(saveTimeout);
                savePage();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a' && isEditorShortcutTarget(e.target)) {
            e.preventDefault();
            openAiAssistModal();
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd' && isEditorShortcutTarget(e.target)) {
            e.preventDefault();
            openSketchModal();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && isEditorShortcutTarget(e.target)) {
            e.preventDefault();
            quill?.history?.undo();
            updateUndoRedoState();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey && isEditorShortcutTarget(e.target)) {
            e.preventDefault();
            quill?.history?.redo();
            updateUndoRedoState();
        }
    });
}

function isEditorShortcutTarget(target) {
    if (!quill || !state.activePage) return false;
    return quill.root.contains(target) || pageTitle.contains(target);
}

function initEditorEnhancements() {
    editorUndoBtn?.addEventListener('click', () => {
        quill?.history?.undo();
        updateUndoRedoState();
    });
    editorRedoBtn?.addEventListener('click', () => {
        quill?.history?.redo();
        updateUndoRedoState();
    });
    editorTocBtn?.addEventListener('click', () => {
        setEditorTocVisible(editorToc.classList.contains('hidden'));
    });
    editorTocCloseBtn?.addEventListener('click', () => {
        setEditorTocVisible(false);
    });
    editorFocusBtn?.addEventListener('click', () => {
        setEditorFocusMode(!dashboardLayout?.classList.contains('editor-focus-mode'));
    });
    editorDrawBtn?.addEventListener('click', () => {
        openSketchModal();
    });
    editorAiBtn?.addEventListener('click', () => {
        openAiAssistModal();
    });
    editorTocList?.addEventListener('click', (e) => {
        const link = e.target.closest('.editor-toc-link');
        if (!link) return;
        document.getElementById(link.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function setEditorFocusMode(enabled) {
    dashboardLayout?.classList.toggle('editor-focus-mode', enabled);
    editorFocusBtn?.classList.toggle('is-active', enabled);
    editorFocusBtn?.setAttribute('aria-pressed', String(enabled));
    const icon = editorFocusBtn?.querySelector('i');
    if (icon) {
        icon.className = enabled ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
    }
    if (editorFocusBtn) {
        editorFocusBtn.title = enabled ? 'Exit focus mode' : 'Focus mode';
    }
}

function setEditorTocVisible(visible) {
    editorToc?.classList.toggle('hidden', !visible);
    editorTocBtn?.classList.toggle('is-active', visible);
    editorTocBtn?.setAttribute('aria-pressed', String(visible));
    if (visible) {
        updateEditorToc();
    }
}

function scheduleEditorStatsUpdate() {
    clearTimeout(editorStatsTimeout);
    editorStatsTimeout = window.setTimeout(updateEditorStats, 120);
}

function updateEditorStats() {
    if (!quill || !editorWordCount) return;

    const text = quill.getText().trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));

    editorWordCount.textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'}`;
    editorCharCount.textContent = `${chars.toLocaleString()} character${chars === 1 ? '' : 's'}`;
    editorReadTime.textContent = words === 0 ? '0 min read' : `~${minutes} min read`;
}

function updateUndoRedoState() {
    if (!quill?.history || !editorUndoBtn || !editorRedoBtn) return;
    editorUndoBtn.disabled = quill.history.stack.undo.length === 0;
    editorRedoBtn.disabled = quill.history.stack.redo.length === 0;
}

function updateEditorToc() {
    if (!quill || !editorTocList) return;

    const headings = quill.root.querySelectorAll('h1, h2, h3');
    const items = [];

    headings.forEach((heading, index) => {
        const text = heading.textContent.trim();
        if (!text) return;
        if (!heading.id) {
            heading.id = `note-heading-${state.activePage?.id || 'draft'}-${index + 1}`;
        }
        items.push({
            id: heading.id,
            text,
            level: parseInt(heading.tagName.slice(1), 10)
        });
    });

    if (items.length === 0) {
        editorTocList.innerHTML = '';
        editorTocEmpty?.classList.remove('hidden');
        observeEditorHeadings([]);
        return;
    }

    editorTocEmpty?.classList.add('hidden');
    editorTocList.innerHTML = items.map(item => `
        <li class="editor-toc-item">
            <button type="button" class="editor-toc-link" data-level="${item.level}" data-target="${item.id}">
                ${escapeHtml(item.text)}
            </button>
        </li>
    `).join('');

    observeEditorHeadings(items.map(item => item.id));
}

function observeEditorHeadings(headingIds) {
    if (editorTocObserver) {
        editorTocObserver.disconnect();
        editorTocObserver = null;
    }

    if (!headingIds.length || editorToc.classList.contains('hidden')) return;

    const editorScroll = document.querySelector('.editor-scroll');
    if (!editorScroll) return;

    editorTocObserver = new IntersectionObserver((entries) => {
        const visible = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length === 0) return;

        const activeId = visible[0].target.id;
        editorTocList.querySelectorAll('.editor-toc-link').forEach(link => {
            link.classList.toggle('is-active', link.dataset.target === activeId);
        });
    }, {
        root: editorScroll,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    });

    headingIds.forEach(id => {
        const heading = document.getElementById(id);
        if (heading) editorTocObserver.observe(heading);
    });
}

function scheduleEditorTocUpdate() {
    clearTimeout(editorTocTimeout);
    editorTocTimeout = window.setTimeout(updateEditorToc, 250);
}

function resetEditorEnhancements() {
    setEditorFocusMode(false);
    setEditorTocVisible(false);
    updateEditorStats();
    updateUndoRedoState();
    if (editorTocObserver) {
        editorTocObserver.disconnect();
        editorTocObserver = null;
    }
}

function initQuill() {
    quill = new Quill('#quillEditor', {
        theme: 'snow',
        placeholder: 'Start writing your note…',
        modules: {
            history: {
                delay: 1000,
                maxStack: 200,
                userOnly: true
            },
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'background': [] }],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'indent': '-1' }, { 'indent': '+1' }],
                ['link', 'image'],
                ['clean']
            ]
        }
    });

    quill.on('text-change', () => {
        clearSearchViewHighlights();
        if (state.activePage) scheduleSave();
        scheduleEditorStatsUpdate();
        scheduleEditorTocUpdate();
        updateUndoRedoState();
    });

    pageTitle.addEventListener('input', () => {
        if (state.activePage) scheduleSave();
    });

    quill.root.addEventListener('paste', handlePaste, false);
    updateEditorStats();
    updateUndoRedoState();
    initAiSelectionTracking();
}

async function checkAuth() {
    try {
        const res = await apiFetch('api/auth.php?action=me');
        const data = await res.json();
        if (data.logged_in) {
            state.userId = data.user_id;
            state.role = data.role;
            state.email = data.email;
            state.hasAiKey = !!data.has_ai_key;
            state.aiModel = data.ai_model || 'google/gemma-4-26b-a4b-it';
            updateEditorAiButtonState();
            if (state.role === 'admin') {
                adminPanelBtn.classList.remove('hidden');
                syncRailAdminVisibility();
            }
            showDashboard();
            loadNotebooks();
        } else {
            if (data.error === 'Account suspended') {
                authError.textContent = data.error;
                authError.classList.remove('hidden');
            }
            showAuth();
        }
    } catch (e) {
        showAuth();
    }
}

authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const res = await apiFetch(`api/auth.php?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.error) {
            authError.textContent = data.error;
            authError.classList.remove('hidden');
        } else {
            state.userId = data.user_id;
            state.role = data.role;
            state.email = data.email || email;
            state.hasAiKey = !!data.has_ai_key;
            state.aiModel = data.ai_model || 'google/gemma-4-26b-a4b-it';
            if (data.csrf_token) {
                csrfToken = data.csrf_token;
            }
            updateEditorAiButtonState();
            authError.classList.add('hidden');
            if (state.role === 'admin') {
                adminPanelBtn.classList.remove('hidden');
                syncRailAdminVisibility();
            }
            showDashboard();
            loadNotebooks();
        }
    } catch (err) {
        authError.textContent = "Connection error";
        authError.classList.remove('hidden');
    }
};

logoutBtn.onclick = async () => {
    await apiFetch('api/auth.php?action=logout', { method: 'POST' });
    csrfToken = null;
    state = {
        userId: null, role: null, email: null, notebooks: [],
        sectionsCache: {}, pagesCache: {},
        expanded: { root: true, starred: true, notebooks: new Set(), sections: new Set() },
        selectedSection: null,
        activeNotebook: null, activeSection: null, activePage: null,
        starredPages: [],
        hasAiKey: false,
        aiModel: 'google/gemma-4-26b-a4b-it'
    };
    updateEditorAiButtonState();
    adminPanelBtn.classList.add('hidden');
    syncRailAdminVisibility();
    closeRailFlyout();
    closeNotesPanel();
    dashboardLayout?.classList.remove('sidebar-notes-panel-open');
    showAuth();
    await fetchCsrfToken();
};

themeToggleBtn.onclick = () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeUI();
};

function showAuth() {
    authView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    adminView.classList.add('hidden');
    userView.classList.add('hidden');
}

function showDashboard() {
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    adminView.classList.add('hidden');
    userView.classList.add('hidden');
}

// Data Loading
async function loadNotebooks(skipRender = false) {
    const res = await apiFetch('api/notebooks.php');
    state.notebooks = await res.json();
    await loadStarredPages();
    if (!skipRender) renderTree();
    if (!state.activePage) {
        await refreshHomePage();
    }
}

async function loadSectionsForNotebook(notebookId) {
    const res = await apiFetch(`api/sections.php?notebook_id=${notebookId}`);
    state.sectionsCache[notebookId] = await res.json();
}

async function loadPagesForSection(sectionId) {
    const res = await apiFetch(`api/pages.php?section_id=${sectionId}`);
    state.pagesCache[sectionId] = await res.json();
}

async function toggleNotebook(notebookId) {
    retractNotesPanelIfOpen();
    const key = String(notebookId);
    if (state.expanded.notebooks.has(key)) {
        state.expanded.notebooks.delete(key);
    } else {
        state.expanded.notebooks.add(key);
        if (!state.sectionsCache[notebookId]) {
            await loadSectionsForNotebook(notebookId);
        }
    }
    renderTree();
}

async function expandPathToPage(page) {
    state.expanded.root = true;

    let notebookId = null;
    for (const nb of state.notebooks) {
        if (!state.sectionsCache[nb.id]) {
            await loadSectionsForNotebook(nb.id);
        }
        const sections = state.sectionsCache[nb.id] || [];
        if (sections.some(s => s.id == page.section_id)) {
            notebookId = nb.id;
            break;
        }
    }

    if (notebookId) {
        state.expanded.notebooks.add(String(notebookId));
        state.selectedSection = { sectionId: page.section_id, notebookId };
    }

    if (!state.pagesCache[page.section_id]) {
        await loadPagesForSection(page.section_id);
    }

    syncNotesPanelLayout();
}

async function openPage(pageId, options = {}) {
    const res = await apiFetch(`api/pages.php?page_id=${pageId}`);
    const page = await res.json();
    if (page) {
        await expandPathToPage(page);
        state.activePage = page;

        for (const nb of state.notebooks) {
            const sections = state.sectionsCache[nb.id] || [];
            if (sections.some(s => s.id == page.section_id)) {
                state.activeNotebook = nb.id;
                break;
            }
        }
        state.activeSection = page.section_id;

        recordRecentPage(page.id);
        updateFavoriteButton(Number(page.is_favorite) === 1);

        pageTitle.value = page.title;
        const delta = quill.clipboard.convert(removeSearchHighlightArtifacts(page.content || ''));
        quill.setContents(delta, 'silent');
        editorArea.classList.remove('hidden');
        emptyEditor.classList.add('hidden');
        updateBreadcrumb(page);
        updateEditorMeta(page);
        setSaveStatus('saved', 'Saved');
        renderTree();
        requestAnimationFrame(() => {
            if (treeLabelEdit) return;

            updateEditorStats();
            updateEditorToc();
            updateUndoRedoState();

            const searchQuery = options.searchQuery || getActiveSearchQuery();
            if (searchQuery.length >= 2) {
                scheduleEditorSearchHighlights(searchQuery, options.matchType || 'content');
                return;
            }

            clearSearchViewHighlights();

            if (page.title === 'Untitled' || page.title === 'Untitled Page' || !page.title) {
                pageTitle.focus();
                pageTitle.select();
            } else {
                quill.focus();
            }
        });
    }
}

// Tree Rendering
function renderTree() {
    const pendingEdit = treeLabelEdit ? {
        type: treeLabelEdit.type,
        id: treeLabelEdit.id,
        value: treeLabelEdit.input.value,
        sectionId: treeLabelEdit.sectionId,
        labelClass: treeLabelEdit.labelClass,
        inputClass: treeLabelEdit.input.className
    } : null;
    treeLabelEdit = null;

    const rootExpanded = state.expanded.root;
    const starredExpanded = state.expanded.starred !== false;

    treeView.innerHTML = `
        <div class="tree">
            <div class="tree-node tree-node-starred">
                <div class="tree-row tree-row-root tree-row-starred" style="--tree-depth: 0" data-tree-type="starred-root">
                    <button class="tree-toggle" data-action="toggle-starred" aria-label="Toggle Starred">
                        <i class="fa-solid fa-chevron-${starredExpanded ? 'down' : 'right'}"></i>
                    </button>
                    <i class="fa-solid fa-star tree-icon tree-icon-starred"></i>
                    <span class="tree-label">Starred</span>
                </div>
                ${starredExpanded ? `<div class="tree-children tree-children-starred">${renderStarredPagesTree(state.starredPages)}</div>` : ''}
            </div>
            <div class="tree-node">
                <div class="tree-row tree-row-root" style="--tree-depth: 0" data-tree-type="root">
                    <button class="tree-toggle" data-action="toggle-root" aria-label="Toggle library">
                        <i class="fa-solid fa-chevron-${rootExpanded ? 'down' : 'right'}"></i>
                    </button>
                    <i class="fa-solid fa-layer-group tree-icon"></i>
                    <span class="tree-label">Library</span>
                    <div class="tree-actions">
                        <button class="tree-action tree-action-add" data-action="create-notebook" title="New folder">
                            <i class="fa-solid fa-folder-plus"></i>
                        </button>
                    </div>
                </div>
                ${rootExpanded ? `<div class="tree-children" data-context-root="true">${renderNotebooksTree()}</div>` : ''}
            </div>
        </div>
    `;

    requestAnimationFrame(scrollActiveTreeRowIntoView);
    renderRail();
    if (railFlyoutNotebookId) {
        renderRailFlyout();
    }
    if (pendingEdit) {
        requestAnimationFrame(() => {
            if (isFlyoutLabelEdit(pendingEdit)) {
                restoreFlyoutLabelEdit(pendingEdit);
            } else {
                restoreTreeLabelEdit(pendingEdit);
            }
        });
    }

    renderSidebarNotesPanel();
}

function renderStarredPagesTree(pages) {
    if (!pages.length) {
        return '<div class="tree-empty tree-empty-starred" style="--tree-empty-depth: 1">Star notes for quick access</div>';
    }

    return pages.map(p => {
        const isActive = state.activePage && state.activePage.id == p.id;
        const title = escapeHtml(p.title || 'Untitled');
        const path = escapeHtml(`${p.notebook_name || 'Folder'} / ${p.section_name || 'Subfolder'}`);

        return `
            <div class="tree-node">
                <div class="tree-row tree-row-starred-note ${isActive ? 'active' : ''}" style="--tree-depth: 1" data-tree-type="starred-page" data-tree-id="${p.id}" data-tree-section-id="${p.section_id}" data-action="open-page" data-id="${p.id}" title="${path}">
                    <span class="tree-toggle-spacer"></span>
                    <i class="fa-solid fa-star tree-icon tree-icon-starred"></i>
                    <span class="tree-label">
                        <span class="tree-label-title">${title}</span>
                        <span class="tree-label-meta">${path}</span>
                    </span>
                    <div class="tree-actions">
                        <button class="tree-action tree-action-star is-starred" data-action="toggle-favorite" data-id="${p.id}" title="Remove from Starred" aria-label="Remove from Starred">
                            <i class="fa-solid fa-star"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderPageStarButton(page) {
    const isStarred = Number(page.is_favorite) === 1;
    return `
        <button
            class="tree-action tree-action-star${isStarred ? ' is-starred' : ''}"
            data-action="toggle-favorite"
            data-id="${page.id}"
            title="${isStarred ? 'Remove from Starred' : 'Add to Starred'}"
            aria-label="${isStarred ? 'Remove from Starred' : 'Add to Starred'}"
        >
            <i class="${isStarred ? 'fa-solid' : 'fa-regular'} fa-star"></i>
        </button>
    `;
}

function renderNotebooksTree() {
    if (state.notebooks.length === 0) {
        return '<div class="tree-empty" style="--tree-empty-depth: 1">No folders yet</div>';
    }

    return state.notebooks.map(nb => {
        const nbKey = String(nb.id);
        const isExpanded = state.expanded.notebooks.has(nbKey);
        const sections = state.sectionsCache[nb.id] || [];

        return `
            <div class="tree-node">
                <div class="tree-row" style="--tree-depth: 1" data-tree-type="notebook" data-tree-id="${nb.id}">
                    <span class="tree-drag-handle" draggable="true" title="Drag to reorder" aria-label="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
                    <button class="tree-toggle" data-action="toggle-notebook" data-id="${nb.id}" aria-label="Toggle folder">
                        <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'}"></i>
                    </button>
                    <i class="fa-solid fa-folder tree-icon"></i>
                    <span class="tree-label">${escapeHtml(nb.name)}</span>
                    <div class="tree-actions">
                        <button class="tree-action tree-action-add" data-action="create-section" data-id="${nb.id}" title="New subfolder">
                            <i class="fa-solid fa-folder-plus"></i>
                        </button>
                        <button class="tree-action tree-action-delete" data-action="delete" data-type="notebook" data-id="${nb.id}" title="Delete folder">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                ${isExpanded ? `<div class="tree-children" data-context-notebook-id="${nb.id}">${renderSectionsTree(sections, nb.id)}</div>` : ''}
            </div>
        `;
    }).join('');
}

function renderSectionsTree(sections, notebookId) {
    if (sections.length === 0) {
        return '<div class="tree-empty" style="--tree-empty-depth: 2">No subfolders</div>';
    }

    return sections.map(sec => {
        const isSelected = state.selectedSection?.sectionId == sec.id;
        const pages = state.pagesCache[sec.id];
        const countLabel = Array.isArray(pages) ? `<span class="tree-label-count">${pages.length}</span>` : '';

        return `
            <div class="tree-node">
                <div
                    class="tree-row ${isSelected ? 'is-selected' : ''}"
                    style="--tree-depth: 2"
                    data-tree-type="section"
                    data-tree-id="${sec.id}"
                    data-tree-notebook-id="${notebookId}"
                    data-action="select-section"
                    data-id="${sec.id}"
                >
                    <span class="tree-drag-handle" draggable="true" title="Drag to reorder or move to another folder" aria-label="Drag to reorder or move to another folder"><i class="fa-solid fa-grip-vertical"></i></span>
                    <span class="tree-toggle-spacer"></span>
                    <i class="fa-solid fa-folder-tree tree-icon"></i>
                    <span class="tree-label">${escapeHtml(sec.name)}</span>${countLabel}
                    <div class="tree-actions">
                        <button class="tree-action tree-action-add" data-action="create-page" data-id="${sec.id}" title="New note">
                            <i class="fa-solid fa-file-circle-plus"></i>
                        </button>
                        <button class="tree-action tree-action-delete" data-action="delete" data-type="section" data-id="${sec.id}" title="Delete subfolder">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderSectionNotesList(pages, sectionId, options = {}) {
    const { variant = 'panel' } = options;

    if (pages.length === 0) {
        return variant === 'flyout'
            ? '<div class="flyout-empty">No notes</div>'
            : '<div class="notes-panel-empty">No notes yet</div>';
    }

    if (variant === 'flyout') {
        return pages.map(p => {
            const isActive = state.activePage && state.activePage.id == p.id;
            return `
                <button
                    class="flyout-page ${isActive ? 'is-active' : ''}"
                    type="button"
                    data-action="open-page"
                    data-id="${p.id}"
                >
                    <i class="fa-regular fa-file-lines"></i>
                    <span>${escapeHtml(p.title || 'Untitled')}</span>
                </button>
            `;
        }).join('');
    }

    return pages.map(p => {
        const isActive = state.activePage && state.activePage.id == p.id;

        return `
            <div class="tree-node">
                <div class="tree-row ${isActive ? 'active' : ''}" style="--tree-depth: 0" data-tree-type="page" data-tree-id="${p.id}" data-tree-section-id="${sectionId}" data-action="open-page" data-id="${p.id}">
                    <span class="tree-drag-handle" draggable="true" title="Drag to reorder or move to another subfolder" aria-label="Drag to reorder or move to another subfolder"><i class="fa-solid fa-grip-vertical"></i></span>
                    <span class="tree-toggle-spacer"></span>
                    <i class="fa-regular fa-file-lines tree-icon"></i>
                    <span class="tree-label">${escapeHtml(p.title || 'Untitled')}</span>
                    <div class="tree-actions">
                        ${renderPageStarButton(p)}
                        <button class="tree-action tree-action-delete" data-action="delete" data-type="page" data-id="${p.id}" title="Delete note">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderSidebarNotesPanel() {
    if (!sidebarNotesPanel || !sidebarNotesPanelBody) return;

    const meta = getSelectedSectionMeta();
    syncNotesPanelLayout();

    if (!meta) {
        sidebarNotesPanelTitle.textContent = '';
        sidebarNotesPanelBreadcrumb.textContent = '';
        sidebarNotesPanelBody.innerHTML = '';
        return;
    }

    const { selected, notebook, section } = meta;
    const pages = state.pagesCache[selected.sectionId] || [];

    sidebarNotesPanelTitle.textContent = section?.name || 'Subfolder';
    sidebarNotesPanelBreadcrumb.textContent = notebook
        ? `${notebook.name} / ${section?.name || 'Subfolder'}`
        : '';

    sidebarNotesPanelBody.innerHTML = `
        <div class="notes-panel-list">
            ${renderSectionNotesList(pages, selected.sectionId)}
        </div>
        <div class="notes-panel-footer">
            <button class="notes-panel-new-btn" type="button" data-action="create-page" data-id="${selected.sectionId}">
                <span class="notes-panel-new-btn-icon" aria-hidden="true">
                    <i class="fa-solid fa-plus"></i>
                </span>
                <span class="notes-panel-new-btn-label">New note</span>
            </button>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function hideEditor() {
    state.activePage = null;
    state.activeNotebook = null;
    state.activeSection = null;
    editorArea.classList.add('hidden');
    emptyEditor.classList.remove('hidden');
    editorMeta.classList.add('hidden');
    editorBreadcrumb.innerHTML = '';
    resetEditorEnhancements();
    renderTree();
    refreshHomePage();
}

// Creation
async function createNotebook() {
    const name = await modalPrompt('New folder', 'Folder name');
    if (!name) return;
    const res = await apiFetch('api/notebooks.php', { method: 'POST', body: JSON.stringify({ name }) });
    const data = await res.json();
    state.notebooks.unshift(data);
    state.expanded.root = true;
    state.expanded.notebooks.add(String(data.id));
    state.sectionsCache[data.id] = [];
    state.activeNotebook = data.id;
    renderTree();
}

async function createSection(notebookId) {
    const name = await modalPrompt('New subfolder', 'Subfolder name');
    if (!name) return;
    await createSectionWithName(notebookId, name);
    renderTree();
}

async function createSectionWithName(notebookId, name) {
    const res = await apiFetch('api/sections.php', {
        method: 'POST',
        body: JSON.stringify({ notebook_id: notebookId, name })
    });
    const data = await res.json();
    if (!data?.id) return null;

    if (!state.sectionsCache[notebookId]) {
        state.sectionsCache[notebookId] = [];
    }
    state.sectionsCache[notebookId].push(data);
    state.expanded.root = true;
    state.expanded.notebooks.add(String(notebookId));
    state.pagesCache[data.id] = [];
    state.activeNotebook = notebookId;
    state.activeSection = data.id;
    state.selectedSection = { sectionId: data.id, notebookId };
    return data.id;
}

async function createPage(sectionId) {
    const title = 'Untitled';
    const res = await apiFetch('api/pages.php', {
        method: 'POST',
        body: JSON.stringify({ section_id: sectionId, title, content: '' })
    });
    const data = await res.json();
    if (!state.pagesCache[sectionId]) {
        state.pagesCache[sectionId] = [];
    }
    state.pagesCache[sectionId].unshift({ ...data, title, updated_at: new Date().toISOString() });
    const notebookId = findNotebookIdForSection(sectionId);
    state.activeSection = sectionId;
    if (notebookId) {
        state.selectedSection = { sectionId, notebookId };
    }
    await openPage(data.id);
}

// Deletion
async function deleteItem(type, id, e) {
    e?.stopPropagation?.();
    const labels = { notebook: 'folder', section: 'subfolder', page: 'note' };
    const label = labels[type] || type;
    const confirmed = await modalConfirm(`This will permanently delete this ${label}.`, 'Delete ' + label);
    if (!confirmed) return;

    let endpoint = '';
    if (type === 'notebook') endpoint = `api/notebooks.php?id=${id}`;
    if (type === 'section') endpoint = `api/sections.php?id=${id}`;
    if (type === 'page') endpoint = `api/pages.php?id=${id}`;

    await apiFetch(endpoint, { method: 'DELETE' });

    if (type === 'notebook') {
        state.notebooks = state.notebooks.filter(n => n.id != id);
        delete state.sectionsCache[id];
        state.expanded.notebooks.delete(String(id));
        if (state.activeNotebook == id) {
            state.activeNotebook = null;
            state.activeSection = null;
            state.selectedSection = null;
            hideEditor();
        }
        if (state.selectedSection?.notebookId == id) {
            state.selectedSection = null;
            syncNotesPanelLayout();
        }
    }
    if (type === 'section') {
        for (const nbId of Object.keys(state.sectionsCache)) {
            state.sectionsCache[nbId] = state.sectionsCache[nbId].filter(s => s.id != id);
        }
        delete state.pagesCache[id];
        state.expanded.sections.delete(String(id));
        if (state.selectedSection?.sectionId == id) {
            state.selectedSection = null;
            syncNotesPanelLayout();
        }
        if (state.activeSection == id) {
            state.activeSection = null;
            hideEditor();
        }
    }
    if (type === 'page') {
        for (const secId of Object.keys(state.pagesCache)) {
            state.pagesCache[secId] = state.pagesCache[secId].filter(p => p.id != id);
        }
        removeRecentPage(id);
        await loadStarredPages();
        if (state.activePage && state.activePage.id == id) hideEditor();
        else await refreshHomePage();
    }

    renderTree();
}

// Autosave
function scheduleSave() {
    setSaveStatus('saving', 'Saving…');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(savePage, 1500);
}

async function savePage() {
    if (!state.activePage) return;
    clearSearchViewHighlights();
    const title = pageTitle.value;
    const content = quill.root.innerHTML;

    try {
        await apiFetch('api/pages.php', {
            method: 'PUT',
            body: JSON.stringify({ id: state.activePage.id, title, content })
        });

        const now = new Date().toISOString();
        state.activePage.title = title;
        state.activePage.updated_at = now;
        setSaveStatus('saved', 'Saved');
        updateEditorMeta(state.activePage);

        const sectionId = state.activePage.section_id || state.activeSection;
        const pages = state.pagesCache[sectionId];
        if (pages) {
            const pageIndex = pages.findIndex(p => p.id == state.activePage.id);
            if (pageIndex > -1) {
                pages[pageIndex].title = title;
                pages[pageIndex].updated_at = now;
            }
        }

        const starred = state.starredPages.find(p => p.id == state.activePage.id);
        if (starred) {
            starred.title = title;
            starred.updated_at = now;
            state.starredPages.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        }

        renderTree();
    } catch (err) {
        setSaveStatus('error', 'Save failed');
    }
}

// Image upload (shared by paste and sketch)
async function uploadPageImage(imageFile, { ocr = true } = {}) {
    const formData = new FormData();
    formData.append('image', imageFile);
    if (state.activePage) formData.append('page_id', state.activePage.id);

    if (ocr) {
        setSaveStatus('uploading', 'Extracting text…');
        const ocrResult = await Tesseract.recognize(imageFile, 'eng');
        formData.append('ocr_text', ocrResult.data.text);
    }

    setSaveStatus('uploading', 'Uploading…');
    const res = await apiFetch('api/upload.php', { method: 'POST', body: formData });
    return res.json();
}

// Image Paste & OCR
async function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let imageFile = null;

    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file' && item.type.includes('image/')) {
            imageFile = item.getAsFile();
            break;
        }
    }

    if (imageFile) {
        e.preventDefault();
        setSaveStatus('uploading', 'Uploading…');

        try {
            const data = await uploadPageImage(imageFile, { ocr: true });

            if (data.success) {
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', data.url);
                quill.setSelection(range.index + 1);
                scheduleSave();
            } else {
                setSaveStatus('error', 'Upload failed');
                await modalAlert(data.error, 'Upload failed');
            }
        } catch (err) {
            console.error(err);
            setSaveStatus('error', 'Upload failed');
        }
    }
}

// Sketch drawing modal
function resetSketchSession() {
    sketchSession.strokes = [];
    sketchSession.undone = [];
    sketchSession.currentStroke = null;
    sketchSession.tool = 'pen';
    sketchSession.color = '#1c1917';
    sketchSession.sizeIndex = 3;
    sketchSession.canvasWidth = 640;
    sketchSession.canvasHeight = 400;
    sketchSession.isDrawing = false;
    sketchSession.isResizing = false;
    sketchResizeState = null;
    if (sketchCropToggle) sketchCropToggle.checked = true;
    updateSketchToolbarUi();
}

function sketchSerialize() {
    return JSON.stringify(sketchSession.strokes);
}

function sketchDeserialize(json) {
    try {
        const strokes = typeof json === 'string' ? JSON.parse(json) : json;
        sketchSession.strokes = Array.isArray(strokes) ? strokes : [];
        sketchSession.undone = [];
        sketchSession.currentStroke = null;
        redrawSketchCanvas();
        updateSketchToolbarUi();
    } catch (err) {
        console.error(err);
    }
}

function getSketchCanvasPoint(e) {
    const rect = sketchCanvas.getBoundingClientRect();
    const scaleX = sketchCanvas.width / rect.width;
    const scaleY = sketchCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function getSketchSizeOptions() {
    return sketchSession.tool === 'text' ? SKETCH_TEXT_SIZES : SKETCH_BRUSH_SIZES;
}

function getSketchSizeValue() {
    const options = getSketchSizeOptions();
    const index = Math.max(0, Math.min(options.length - 1, sketchSession.sizeIndex));
    return options[index];
}

function getSketchStrokeWidth(logicalWidth) {
    return logicalWidth * sketchSession.dpr;
}

function normalizeSketchColor(color) {
    if (!color) return '#1c1917';
    const hex = color.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-f]{3}$/.test(hex)) {
        return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return '#1c1917';
}

function isSketchShapeTool(tool) {
    return SKETCH_SHAPE_TOOLS.has(tool);
}

function measureSketchTextStroke(stroke) {
    if (!sketchCanvas || stroke.tool !== 'text' || !stroke.text) {
        return { width: 0, height: 0 };
    }
    const ctx = sketchCanvas.getContext('2d');
    const fontSize = stroke.fontSize || getSketchStrokeWidth(getSketchSizeValue());
    ctx.save();
    ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
    const metrics = ctx.measureText(stroke.text);
    ctx.restore();
    return {
        width: metrics.width,
        height: fontSize * 1.2
    };
}

function clampSketchCanvasDimension(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value)));
}

function updateSketchCanvasSizeLabel() {
    if (sketchCanvasSizeLabel) {
        sketchCanvasSizeLabel.textContent = `${sketchSession.canvasWidth} × ${sketchSession.canvasHeight}`;
    }
}

function getSketchShapeRect(points) {
    if (!points || points.length < 2) return null;
    const [p0, p1] = points;
    const x = Math.min(p0.x, p1.x);
    const y = Math.min(p0.y, p1.y);
    const w = Math.abs(p1.x - p0.x);
    const h = Math.abs(p1.y - p0.y);
    return { x, y, w, h };
}

function drawSketchArrowHead(ctx, x0, y0, x1, y1, width) {
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const headLen = Math.max(width * 3, 10 * sketchSession.dpr);
    const headAngle = Math.PI / 7;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(
        x1 - headLen * Math.cos(angle - headAngle),
        y1 - headLen * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
        x1 - headLen * Math.cos(angle + headAngle),
        y1 - headLen * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();
}

function drawSketchStroke(ctx, stroke) {
    if (!stroke.points.length) return;

    const isEraser = stroke.tool === 'eraser';
    const isHighlighter = stroke.tool === 'highlighter';

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        if (isHighlighter) {
            ctx.globalAlpha = 0.35;
        }
    }

    ctx.lineWidth = isHighlighter ? stroke.width * 2.5 : stroke.width;

    if (stroke.tool === 'text' && stroke.text && stroke.points.length) {
        const fontSize = stroke.fontSize || stroke.width || getSketchStrokeWidth(16);
        ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
        ctx.restore();
        return;
    }

    if (isSketchShapeTool(stroke.tool) && stroke.points.length >= 2) {
        const [p0, p1] = stroke.points;
        const rect = getSketchShapeRect(stroke.points);

        switch (stroke.tool) {
            case 'line':
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
                break;
            case 'arrow':
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.stroke();
                if (!isEraser) {
                    drawSketchArrowHead(ctx, p0.x, p0.y, p1.x, p1.y, stroke.width);
                }
                break;
            case 'rect':
                if (rect.w > 0 && rect.h > 0) {
                    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
                }
                break;
            case 'fillRect':
                if (rect.w > 0 && rect.h > 0) {
                    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                }
                break;
            case 'ellipse':
                if (rect.w > 0 && rect.h > 0) {
                    ctx.beginPath();
                    ctx.ellipse(
                        rect.x + rect.w / 2,
                        rect.y + rect.h / 2,
                        rect.w / 2,
                        rect.h / 2,
                        0,
                        0,
                        Math.PI * 2
                    );
                    ctx.stroke();
                }
                break;
            default:
                break;
        }
        ctx.restore();
        return;
    }

    if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    }
    ctx.restore();
}

function redrawSketchCanvas() {
    if (!sketchCanvas) return;
    const ctx = sketchCanvas.getContext('2d');
    ctx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height);

    for (const stroke of sketchSession.strokes) {
        drawSketchStroke(ctx, stroke);
    }
    if (sketchSession.currentStroke) {
        drawSketchStroke(ctx, sketchSession.currentStroke);
    }
}

function getSingleSketchStrokeBounds(stroke) {
    if (stroke.tool === 'text' && stroke.points.length) {
        const { width, height } = measureSketchTextStroke(stroke);
        const x = stroke.points[0].x;
        const y = stroke.points[0].y;
        return {
            minX: x,
            minY: y,
            maxX: x + width,
            maxY: y + height
        };
    }

    const pad = stroke.width / 2;

    if (isSketchShapeTool(stroke.tool) && stroke.points.length >= 2) {
        const rect = getSketchShapeRect(stroke.points);
        if (!rect) return null;
        return {
            minX: rect.x - pad,
            minY: rect.y - pad,
            maxX: rect.x + rect.w + pad,
            maxY: rect.y + rect.h + pad
        };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of stroke.points) {
        minX = Math.min(minX, point.x - pad);
        minY = Math.min(minY, point.y - pad);
        maxX = Math.max(maxX, point.x + pad);
        maxY = Math.max(maxY, point.y + pad);
    }

    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
}

function scaleSketchStrokes(prevWidth, prevHeight, nextWidth, nextHeight) {
    if (prevWidth <= 0 || prevHeight <= 0) return;
    if (prevWidth === nextWidth && prevHeight === nextHeight) return;

    const scaleX = nextWidth / prevWidth;
    const scaleY = nextHeight / prevHeight;
    const scaleStroke = (stroke) => {
        if (!stroke) return;
        stroke.width *= scaleX;
        for (const point of stroke.points) {
            point.x *= scaleX;
            point.y *= scaleY;
        }
    };
    sketchSession.strokes.forEach(scaleStroke);
    scaleStroke(sketchSession.currentStroke);
}

function getSketchCanvasMaxBounds() {
    const wrap = sketchCanvas?.closest('.sketch-canvas-wrap');
    if (!wrap) {
        return { maxWidth: 640, maxHeight: 400 };
    }

    const rect = wrap.getBoundingClientRect();
    const style = window.getComputedStyle(wrap);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

    return {
        maxWidth: Math.max(Math.floor(rect.width - padX), SKETCH_CANVAS_MIN.width),
        maxHeight: Math.max(Math.floor(rect.height - padY), SKETCH_CANVAS_MIN.height)
    };
}

function setSketchCanvasDimensions(width, height) {
    if (!sketchCanvas) return;

    const { maxWidth, maxHeight } = getSketchCanvasMaxBounds();
    const nextWidth = clampSketchCanvasDimension(
        Math.min(width, maxWidth),
        SKETCH_CANVAS_MIN.width,
        SKETCH_CANVAS_MAX.width
    );
    const nextHeight = clampSketchCanvasDimension(
        Math.min(height, maxHeight),
        SKETCH_CANVAS_MIN.height,
        SKETCH_CANVAS_MAX.height
    );

    sketchSession.canvasWidth = nextWidth;
    sketchSession.canvasHeight = nextHeight;
    sketchSession.dpr = window.devicePixelRatio || 1;

    sketchCanvas.style.width = `${nextWidth}px`;
    sketchCanvas.style.height = `${nextHeight}px`;
    sketchCanvas.width = Math.floor(nextWidth * sketchSession.dpr);
    sketchCanvas.height = Math.floor(nextHeight * sketchSession.dpr);

    redrawSketchCanvas();
    updateSketchCanvasSizeLabel();
}

function getSketchDefaultCanvasSize() {
    const { maxWidth, maxHeight } = getSketchCanvasMaxBounds();
    let width = maxWidth;
    let height = Math.round(width * 0.58);

    if (height > maxHeight) {
        height = maxHeight;
        width = Math.round(height / 0.58);
    }

    return {
        width: clampSketchCanvasDimension(width, SKETCH_CANVAS_MIN.width, SKETCH_CANVAS_MAX.width),
        height: clampSketchCanvasDimension(height, SKETCH_CANVAS_MIN.height, SKETCH_CANVAS_MAX.height)
    };
}

function applySketchCanvasSize() {
    setSketchCanvasDimensions(sketchSession.canvasWidth, sketchSession.canvasHeight);
}

function getSketchStrokeBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const stroke of sketchSession.strokes) {
        const bounds = getSingleSketchStrokeBounds(stroke);
        if (!bounds) continue;
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
    }

    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
}

function updateSketchToolbarUi() {
    sketchOverlay?.querySelectorAll('[data-sketch-tool]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.sketchTool === sketchSession.tool);
    });

    const activeColor = normalizeSketchColor(sketchSession.color);
    let matchedPreset = false;
    sketchColorGrid?.querySelectorAll('.sketch-color-btn').forEach((btn) => {
        const isActive = normalizeSketchColor(btn.dataset.color) === activeColor;
        btn.classList.toggle('is-active', isActive);
        if (isActive) matchedPreset = true;
    });
    if (sketchColorPicker) {
        sketchColorPicker.value = activeColor;
        sketchColorPicker.closest('.sketch-color-custom')?.classList.toggle('is-active', !matchedPreset);
    }

    const sizeOptions = getSketchSizeOptions();
    sketchSession.sizeIndex = Math.max(0, Math.min(sizeOptions.length - 1, sketchSession.sizeIndex));
    if (sketchSizeLabel) {
        sketchSizeLabel.textContent = sketchSession.tool === 'text' ? 'Text' : 'Brush';
    }
    if (sketchSizeValue) {
        sketchSizeValue.textContent = String(getSketchSizeValue());
    }
    if (sketchSizePrev) {
        sketchSizePrev.disabled = sketchSession.sizeIndex <= 0;
    }
    if (sketchSizeNext) {
        sketchSizeNext.disabled = sketchSession.sizeIndex >= sizeOptions.length - 1;
    }

    updateSketchCanvasSizeLabel();

    if (sketchCanvas) {
        let cursor = 'crosshair';
        if (sketchSession.tool === 'eraser') cursor = 'cell';
        if (sketchSession.tool === 'text') cursor = 'text';
        sketchCanvas.style.cursor = cursor;
    }

    if (sketchUndoBtn) {
        sketchUndoBtn.disabled = sketchSession.strokes.length === 0;
    }
}

function setSketchTool(tool) {
    if (tool !== 'text') {
        cancelSketchTextInput();
    }
    const prevOptions = getSketchSizeOptions();
    const prevValue = getSketchSizeValue();
    sketchSession.tool = tool;
    const nextOptions = getSketchSizeOptions();
    let nextIndex = nextOptions.indexOf(prevValue);
    if (nextIndex === -1) {
        nextIndex = Math.round((sketchSession.sizeIndex / Math.max(prevOptions.length - 1, 1)) * (nextOptions.length - 1));
    }
    sketchSession.sizeIndex = nextIndex;
    updateSketchToolbarUi();
}

function setSketchColor(color) {
    sketchSession.color = normalizeSketchColor(color);
    if (sketchSession.tool === 'eraser') {
        setSketchTool('pen');
    } else {
        updateSketchToolbarUi();
    }
}

function stepSketchSize(delta) {
    const options = getSketchSizeOptions();
    sketchSession.sizeIndex = Math.max(0, Math.min(options.length - 1, sketchSession.sizeIndex + delta));
    updateSketchToolbarUi();
}

function renderSketchColorGrid() {
    if (!sketchColorGrid) return;
    sketchColorGrid.innerHTML = SKETCH_PALETTE.map((color) => (
        `<button type="button" class="sketch-color-btn${normalizeSketchColor(color) === normalizeSketchColor(sketchSession.color) ? ' is-active' : ''}" data-color="${color}" aria-label="Color ${color}" title="${color}" style="--swatch-color: ${color}"></button>`
    )).join('');
    sketchColorGrid.querySelectorAll('.sketch-color-btn').forEach((btn) => {
        btn.addEventListener('click', () => setSketchColor(btn.dataset.color));
    });
}

async function placeSketchTextAt(point) {
    showSketchTextInput(point);
}

function showSketchTextInput(point) {
    if (!sketchTextInput || !sketchCanvas) return;

    cancelSketchTextInput(false);

    const rect = sketchCanvas.getBoundingClientRect();
    const scaleX = rect.width / sketchCanvas.width;
    const scaleY = rect.height / sketchCanvas.height;
    const fontSize = getSketchSizeValue();

    sketchTextEdit = {
        point,
        fontSize: getSketchStrokeWidth(getSketchSizeValue())
    };

    sketchTextInput.style.left = `${rect.left + point.x * scaleX}px`;
    sketchTextInput.style.top = `${rect.top + point.y * scaleY}px`;
    sketchTextInput.style.fontSize = `${fontSize}px`;
    sketchTextInput.style.color = sketchSession.color;
    sketchTextInput.style.minWidth = `${Math.max(fontSize * 4, 80)}px`;
    sketchTextInput.value = '';
    sketchTextInput.classList.remove('hidden');
    sketchTextInput.focus();
}

function commitSketchTextInput() {
    if (!sketchTextInput || !sketchTextEdit) return;

    const text = sketchTextInput.value.trim();
    const edit = sketchTextEdit;
    hideSketchTextInput();

    if (!text) return;

    sketchSession.undone = [];
    sketchSession.strokes.push({
        tool: 'text',
        color: sketchSession.color,
        text,
        fontSize: edit.fontSize,
        width: 0,
        points: [edit.point]
    });
    redrawSketchCanvas();
    updateSketchToolbarUi();
}

function cancelSketchTextInput(clearEdit = true) {
    hideSketchTextInput();
    if (clearEdit) sketchTextEdit = null;
}

function hideSketchTextInput() {
    if (!sketchTextInput) return;
    sketchTextInput.classList.add('hidden');
    sketchTextInput.value = '';
    if (sketchTextEdit) sketchTextEdit = null;
}

function sketchResizePointerDown(e) {
    if (!sketchResizeHandle || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    sketchSession.isResizing = true;
    sketchResizeState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: sketchSession.canvasWidth,
        startHeight: sketchSession.canvasHeight
    };
    sketchResizeHandle.setPointerCapture(e.pointerId);
}

function sketchResizePointerMove(e) {
    if (!sketchResizeState || e.pointerId !== sketchResizeState.pointerId) return;
    e.preventDefault();

    const dx = e.clientX - sketchResizeState.startX;
    const dy = e.clientY - sketchResizeState.startY;
    setSketchCanvasDimensions(
        sketchResizeState.startWidth + dx,
        sketchResizeState.startHeight + dy
    );
}

function sketchResizePointerUp(e) {
    if (!sketchResizeState || e.pointerId !== sketchResizeState.pointerId) return;
    e.preventDefault();

    if (sketchResizeHandle?.hasPointerCapture?.(e.pointerId)) {
        sketchResizeHandle.releasePointerCapture(e.pointerId);
    }
    sketchSession.isResizing = false;
    sketchResizeState = null;
}

function sketchPointerDown(e) {
    if (!sketchCanvas || e.button !== 0 || sketchSession.isResizing) return;
    e.preventDefault();

    if (sketchSession.tool === 'text') {
        placeSketchTextAt(getSketchCanvasPoint(e));
        return;
    }

    sketchCanvas.setPointerCapture(e.pointerId);

    const point = getSketchCanvasPoint(e);
    sketchSession.isDrawing = true;
    sketchSession.undone = [];
    sketchSession.currentStroke = {
        tool: sketchSession.tool,
        color: sketchSession.color,
        width: getSketchStrokeWidth(getSketchSizeValue()),
        points: [point]
    };

    if (isSketchShapeTool(sketchSession.tool)) {
        sketchSession.currentStroke.points.push({ ...point });
    }

    redrawSketchCanvas();
}

function sketchPointerMove(e) {
    if (!sketchSession.isDrawing || !sketchSession.currentStroke) return;
    e.preventDefault();
    const point = getSketchCanvasPoint(e);

    if (isSketchShapeTool(sketchSession.tool)) {
        sketchSession.currentStroke.points[1] = point;
    } else {
        sketchSession.currentStroke.points.push(point);
    }
    redrawSketchCanvas();
}

function sketchPointerUp(e) {
    if (!sketchSession.isDrawing || !sketchSession.currentStroke) return;
    e.preventDefault();
    if (sketchCanvas.hasPointerCapture?.(e.pointerId)) {
        sketchCanvas.releasePointerCapture(e.pointerId);
    }

    const stroke = sketchSession.currentStroke;
    if (isSketchShapeTool(stroke.tool)) {
        const [p0, p1] = stroke.points;
        const moved = Math.hypot(p1.x - p0.x, p1.y - p0.y) > 2 * sketchSession.dpr;
        if (!moved) {
            sketchSession.currentStroke = null;
            sketchSession.isDrawing = false;
            redrawSketchCanvas();
            return;
        }
    }

    sketchSession.strokes.push(stroke);
    sketchSession.currentStroke = null;
    sketchSession.isDrawing = false;
    redrawSketchCanvas();
    updateSketchToolbarUi();
}

function sketchUndo() {
    if (!sketchSession.strokes.length) return;
    const stroke = sketchSession.strokes.pop();
    sketchSession.undone.push(stroke);
    redrawSketchCanvas();
    updateSketchToolbarUi();
}

async function sketchClear() {
    if (!sketchSession.strokes.length) return;
    const ok = await modalConfirm('Clear the entire drawing?', 'Clear canvas');
    if (!ok) return;
    sketchSession.strokes = [];
    sketchSession.undone = [];
    sketchSession.currentStroke = null;
    redrawSketchCanvas();
    updateSketchToolbarUi();
}

function sketchExportPngBlob({ crop = false } = {}) {
    return new Promise((resolve) => {
        if (!sketchCanvas) {
            resolve(null);
            return;
        }

        if (!crop) {
            sketchCanvas.toBlob((blob) => resolve(blob), 'image/png');
            return;
        }

        const bounds = getSketchStrokeBounds();
        if (!bounds) {
            sketchCanvas.toBlob((blob) => resolve(blob), 'image/png');
            return;
        }

        const padding = Math.round(12 * sketchSession.dpr);
        const x = Math.max(0, Math.floor(bounds.minX - padding));
        const y = Math.max(0, Math.floor(bounds.minY - padding));
        const w = Math.min(
            sketchCanvas.width - x,
            Math.ceil(bounds.maxX - bounds.minX + padding * 2)
        );
        const h = Math.min(
            sketchCanvas.height - y,
            Math.ceil(bounds.maxY - bounds.minY + padding * 2)
        );

        if (w <= 0 || h <= 0) {
            sketchCanvas.toBlob((blob) => resolve(blob), 'image/png');
            return;
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = w;
        exportCanvas.height = h;
        const ctx = exportCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(sketchCanvas, x, y, w, h, 0, 0, w, h);
        exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

function openSketchModal() {
    if (!state.activePage || !quill) return;

    resetSketchSession();
    sketchOverlay?.classList.remove('hidden');
    sketchOverlay?.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const { width, height } = getSketchDefaultCanvasSize();
            sketchSession.canvasWidth = width;
            sketchSession.canvasHeight = height;
            applySketchCanvasSize();
            sketchCanvas?.focus();
        });
    });
}

function closeSketchModal() {
    cancelSketchTextInput();
    sketchSession.isDrawing = false;
    sketchSession.currentStroke = null;
    sketchOverlay?.classList.add('hidden');
    sketchOverlay?.setAttribute('aria-hidden', 'true');
}

async function requestCloseSketchModal() {
    if (!sketchSession.strokes.length) {
        closeSketchModal();
        return;
    }
    const ok = await modalConfirm('Discard your drawing?', 'Unsaved drawing');
    if (ok) closeSketchModal();
}

async function insertSketchIntoNote() {
    if (!state.activePage || !quill) return;
    if (!sketchSession.strokes.length) {
        await modalAlert('Draw something before inserting.', 'Empty sketch');
        return;
    }

    sketchInsertBtn.disabled = true;
    try {
        const crop = sketchCropToggle?.checked !== false;
        const blob = await sketchExportPngBlob({ crop });
        if (!blob) {
            await modalAlert('Could not export the drawing.', 'Export failed');
            return;
        }

        const file = new File([blob], 'sketch.png', { type: 'image/png' });
        const data = await uploadPageImage(file, { ocr: false });

        if (data.success) {
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', data.url);
            quill.setSelection(range.index + 1);
            scheduleSave();
            closeSketchModal();
        } else {
            setSaveStatus('error', 'Upload failed');
            await modalAlert(data.error || 'Upload failed', 'Upload failed');
        }
    } catch (err) {
        console.error(err);
        setSaveStatus('error', 'Upload failed');
        await modalAlert('Upload failed. Please try again.', 'Upload failed');
    } finally {
        sketchInsertBtn.disabled = false;
    }
}

function initSketchModal() {
    if (!sketchOverlay || !sketchCanvas) return;

    renderSketchColorGrid();

    sketchCloseBtn?.addEventListener('click', () => requestCloseSketchModal());
    sketchCancelBtn?.addEventListener('click', () => requestCloseSketchModal());
    sketchInsertBtn?.addEventListener('click', () => insertSketchIntoNote());
    sketchUndoBtn?.addEventListener('click', () => sketchUndo());
    sketchClearBtn?.addEventListener('click', () => sketchClear());
    sketchSizePrev?.addEventListener('click', () => stepSketchSize(-1));
    sketchSizeNext?.addEventListener('click', () => stepSketchSize(1));
    sketchColorPicker?.addEventListener('input', (e) => setSketchColor(e.target.value));

    sketchTextInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitSketchTextInput();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelSketchTextInput();
        }
    });
    sketchTextInput?.addEventListener('blur', () => {
        if (sketchTextEdit) commitSketchTextInput();
    });

    sketchOverlay.querySelectorAll('[data-sketch-tool]').forEach((btn) => {
        btn.addEventListener('click', () => setSketchTool(btn.dataset.sketchTool));
    });

    sketchOverlay.addEventListener('click', (e) => {
        if (e.target === sketchOverlay) requestCloseSketchModal();
    });

    sketchResizeHandle?.addEventListener('pointerdown', sketchResizePointerDown);
    sketchResizeHandle?.addEventListener('pointermove', sketchResizePointerMove);
    sketchResizeHandle?.addEventListener('pointerup', sketchResizePointerUp);
    sketchResizeHandle?.addEventListener('pointercancel', sketchResizePointerUp);

    sketchCanvas.addEventListener('pointerdown', sketchPointerDown);
    sketchCanvas.addEventListener('pointermove', sketchPointerMove);
    sketchCanvas.addEventListener('pointerup', sketchPointerUp);
    sketchCanvas.addEventListener('pointercancel', sketchPointerUp);
    sketchCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('resize', () => {
        if (sketchOverlay && !sketchOverlay.classList.contains('hidden')) {
            setSketchCanvasDimensions(sketchSession.canvasWidth, sketchSession.canvasHeight);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sketchOverlay && !sketchOverlay.classList.contains('hidden')) {
            e.preventDefault();
            requestCloseSketchModal();
        }
    });
}

// Search
let searchTimeout;
let searchHighlightTimeout;
let lastSearchQuery = '';
let searchHighlightRanges = [];
const SEARCH_HIGHLIGHT_COLOR = '#fde68a';

function getActiveSearchQuery() {
    return (searchInput?.value || lastSearchQuery || '').trim();
}

function findAllMatchIndices(text, query) {
    const indices = [];
    if (!query) return indices;
    const normalizedText = text.normalize('NFC');
    const normalizedQuery = query.normalize('NFC');
    const re = new RegExp(escapeRegex(normalizedQuery), 'gi');
    let match;
    while ((match = re.exec(normalizedText)) !== null) {
        indices.push(match.index);
    }
    return indices;
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightQueryInText(text, query) {
    const safeText = escapeHtml(text || '');
    if (!query) return safeText;
    const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return safeText.replace(re, '<mark class="search-hl">$1</mark>');
}

function removeSearchHighlightArtifacts(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';

    template.content.querySelectorAll('.search-view-hl-target').forEach(el => {
        el.classList.remove('search-view-hl-target');
    });

    template.content.querySelectorAll('mark.search-view-hl').forEach(mark => {
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
    });

    template.content.querySelectorAll('span[style]').forEach(span => {
        const background = span.style.backgroundColor.replace(/\s+/g, '').toLowerCase();
        if (background === 'rgb(253,230,138)' || background === '#fde68a') {
            span.style.backgroundColor = '';
            if (!span.getAttribute('style')) {
                span.removeAttribute('style');
            }
        }
    });

    return template.innerHTML;
}

function clearSearchViewHighlights() {
    if (!quill) return;

    for (const { index, length } of searchHighlightRanges) {
        quill.formatText(index, length, { background: false }, 'silent');
    }
    searchHighlightRanges = [];
}

function scheduleEditorSearchHighlights(query, matchType = 'content') {
    window.setTimeout(() => {
        applySearchSelection(query, matchType);
    }, 60);
}

function refreshEditorSearchHighlights(query = getActiveSearchQuery()) {
    if (!state.activePage || !quill || query.length < 2) {
        clearSearchViewHighlights();
        return;
    }
    scheduleEditorSearchHighlights(query, 'content');
}

function applySearchSelection(query, matchType = 'content') {
    if (!query || query.length < 2) return;

    clearSearchViewHighlights();

    if (matchType === 'title') {
        const value = pageTitle.value;
        const re = new RegExp(escapeRegex(query), 'i');
        const match = value.match(re);
        if (match && match.index != null) {
            pageTitle.setSelectionRange(match.index, match.index + match[0].length);
        }
    }

    if (!quill) return;

    const text = quill.getText();
    const indices = findAllMatchIndices(text, query);
    if (indices.length === 0) {
        return;
    }

    const queryLength = query.length;
    for (const index of indices) {
        quill.formatText(index, queryLength, { background: SEARCH_HIGHLIGHT_COLOR }, 'silent');
        searchHighlightRanges.push({ index, length: queryLength });
    }

    requestAnimationFrame(() => {
        const editorScroll = document.querySelector('.editor-scroll');
        const bounds = quill.getBounds(indices[0], queryLength);
        if (bounds && editorScroll) {
            editorScroll.scrollTop = Math.max(
                0,
                bounds.top + editorScroll.scrollTop - editorScroll.clientHeight / 3
            );
        }
    });
}

function updateSearchClearVisibility() {
    const hasValue = searchInput.value.length > 0;
    searchClearBtn.classList.toggle('hidden', !hasValue);
    searchInput.closest('.search-container')?.classList.toggle('has-value', hasValue);
}

function clearSearchAndReturnHome() {
    clearTimeout(searchTimeout);
    clearTimeout(searchHighlightTimeout);
    searchInput.value = '';
    lastSearchQuery = '';
    searchResults.classList.add('hidden');
    searchResults.innerHTML = '';
    clearSearchViewHighlights();
    updateSearchClearVisibility();
    hideEditor();
    searchInput.blur();
}

function initSearch() {
    homeBtn?.addEventListener('click', () => {
        clearSearchAndReturnHome();
    });

    searchClearBtn.addEventListener('click', () => {
        clearSearchAndReturnHome();
    });

    searchInput.addEventListener('input', (e) => {
        updateSearchClearVisibility();
        clearTimeout(searchTimeout);
        clearTimeout(searchHighlightTimeout);
        const query = e.target.value.trim();
        lastSearchQuery = query;

        if (query.length < 2) {
            searchResults.classList.add('hidden');
            searchResults.innerHTML = '';
            clearSearchViewHighlights();
            return;
        }

        if (state.activePage) {
            searchHighlightTimeout = setTimeout(() => refreshEditorSearchHighlights(query), 200);
        }

        searchTimeout = setTimeout(() => doSearch(query), 300);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchResults.classList.add('hidden');
            searchInput.blur();
        }
        if (e.key === 'Enter') {
            const first = searchResults.querySelector('.search-result-item[data-page-id]');
            if (first && !searchResults.classList.contains('hidden')) {
                e.preventDefault();
                openPageFromSearch(
                    first.dataset.pageId,
                    first.dataset.matchType,
                    lastSearchQuery
                );
            }
        }
    });

    searchResults.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item[data-page-id]');
        if (!item) return;
        openPageFromSearch(item.dataset.pageId, item.dataset.matchType, lastSearchQuery);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.classList.add('hidden');
        }
    });
}

async function openPageFromSearch(pageId, matchType, query) {
    searchResults.classList.add('hidden');
    await openPage(pageId, { searchQuery: query, matchType });
}

function renderSearchResults(payload, query) {
    const findings = Array.isArray(payload) ? payload : (payload.findings || []);
    const total = payload.total ?? findings.length;

    if (findings.length === 0) {
        searchResults.innerHTML = `
            <div class="search-results-empty">
                <i class="fa-solid fa-magnifying-glass"></i>
                <span>No matches in your notes for “${escapeHtml(query)}”</span>
            </div>
        `;
        searchResults.classList.remove('hidden');
        return;
    }

    const noteCount = new Set(findings.map(f => f.page_id)).size;
    const matchLabels = {
        title: 'Title',
        content: 'Note body',
        image: 'Image text'
    };

    searchResults.innerHTML = `
        <div class="search-results-header">
            <span>${total} finding${total === 1 ? '' : 's'} in ${noteCount} note${noteCount === 1 ? '' : 's'}</span>
        </div>
        ${findings.map(f => {
            const isActive = state.activePage?.id == f.page_id;
            const snippet = f.match_type === 'title'
                ? highlightQueryInText(f.title, query)
                : highlightQueryInText(f.snippet || f.title, query);

            return `
                <button
                    type="button"
                    class="search-result-item${isActive ? ' is-active' : ''}"
                    data-page-id="${f.page_id}"
                    data-match-type="${escapeHtml(f.match_type)}"
                >
                    <div class="search-result-top">
                        <div class="search-result-title">${escapeHtml(f.title || 'Untitled')}</div>
                        <span class="search-result-badge search-result-badge-${escapeHtml(f.match_type)}">${matchLabels[f.match_type] || 'Match'}</span>
                    </div>
                    <div class="search-result-path">
                        <i class="fa-solid fa-folder-tree"></i>
                        <span>${escapeHtml(f.notebook_name)} / ${escapeHtml(f.section_name)}</span>
                    </div>
                    <div class="search-result-snippet">${snippet}</div>
                    ${f.image_url ? `<img src="${escapeHtml(f.image_url)}" alt="Matched image" class="search-result-thumb">` : ''}
                </button>
            `;
        }).join('')}
    `;
    searchResults.classList.remove('hidden');
}

async function doSearch(query) {
    try {
        const params = new URLSearchParams({
            q: query,
            _: String(Date.now())
        });
        const res = await apiFetch(`api/search.php?${params.toString()}`, { cache: 'no-store' });
        let payload = { findings: [], total: 0 };
        const text = await res.text();
        if (text) {
            payload = JSON.parse(text);
        }
        if (query !== lastSearchQuery) return;
        if (!res.ok || payload.error) {
            searchResults.innerHTML = `
                <div class="search-results-empty">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>Search failed. Please try again.</span>
                </div>
            `;
            searchResults.classList.remove('hidden');
            return;
        }
        renderSearchResults(payload, query);
    } catch (err) {
        if (query !== lastSearchQuery) return;
        searchResults.innerHTML = `
            <div class="search-results-empty">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>Search failed. Please try again.</span>
            </div>
        `;
        searchResults.classList.remove('hidden');
    }
}

function parseDownloadFilename(contentDisposition, fallback) {
    if (!contentDisposition) return fallback;
    const match = /filename="([^"]+)"/i.exec(contentDisposition);
    return match ? match[1] : fallback;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function exportArchive(scope = 'user') {
    const url = scope === 'system' ? 'api/export.php?scope=system' : 'api/export.php';
    const fallback = scope === 'system'
        ? `mynote-system-backup-${new Date().toISOString().slice(0, 10)}.mynote.zip`
        : `mynote-backup-${new Date().toISOString().slice(0, 10)}.mynote.zip`;

    const res = await apiFetch(url);
    if (!res.ok) {
        let message = 'Export failed';
        try {
            const data = await res.json();
            if (data.error) message = data.error;
        } catch (_) { /* ignore */ }
        await modalAlert(message, 'Export failed');
        return;
    }

    const blob = await res.blob();
    const filename = parseDownloadFilename(res.headers.get('Content-Disposition'), fallback);
    downloadBlob(blob, filename);
}

async function reloadAfterImport() {
    state.sectionsCache = {};
    state.pagesCache = {};
    state.expanded = { root: true, notebooks: new Set(), sections: new Set() };
    state.activeNotebook = null;
    state.activeSection = null;
    hideEditor();
    await loadNotebooks();
    renderRail();
}

function formatImportSummary(summary) {
    const parts = [
        `${summary.notebooks_imported || 0} folder(s)`,
        `${summary.pages_imported || 0} note(s)`,
        `${summary.assets_restored || 0} image(s)`
    ];
    if (summary.users_created) {
        parts.unshift(`${summary.users_created} user(s) created`);
    }
    return parts.join(', ');
}

async function importArchive(file, mode, scope = 'user') {
    const formData = new FormData();
    formData.append('archive', file);
    formData.append('mode', mode);
    formData.append('scope', scope);

    const res = await apiFetch('api/import.php', { method: 'POST', body: formData });
    let payload = {};
    try {
        payload = await res.json();
    } catch (_) {
        throw new Error('Invalid response from server');
    }

    if (!res.ok || payload.error) {
        throw new Error(payload.error || 'Import failed');
    }

    return payload.summary || {};
}

async function handleUserImport(file) {
    const mode = userImportMode?.value || 'merge';

    if (mode === 'replace') {
        const confirmed = await modalConfirm(
            'This will permanently delete all of your current folders and notes before importing the backup.',
            'Replace all notes?',
            'Replace and import'
        );
        if (!confirmed) return;
    }

    try {
        const summary = await importArchive(file, mode, 'user');
        await reloadAfterImport();
        if (userImportSummary) {
            userImportSummary.textContent = `Last import: ${formatImportSummary(summary)}`;
            userImportSummary.classList.remove('hidden');
        }
        await modalAlert(`Import complete: ${formatImportSummary(summary)}`, 'Import successful');
    } catch (err) {
        await modalAlert(err.message || 'Import failed', 'Import failed');
    }
}

async function handleSystemImport(file) {
    const mode = systemImportMode?.value || 'merge';

    if (mode === 'replace') {
        const confirmed = await modalConfirm(
            'This will permanently delete ALL folders and notes for EVERY user before importing. User accounts are kept, but all note data will be wiped.',
            'Replace all notes for all users?',
            'Replace and import'
        );
        if (!confirmed) return;
    }

    try {
        const summary = await importArchive(file, mode, 'system');
        if (adminImportSummary) {
            adminImportSummary.textContent = `Last import: ${formatImportSummary(summary)}`;
            adminImportSummary.classList.remove('hidden');
        }
        await loadAdminUsers();
        await modalAlert(`System import complete: ${formatImportSummary(summary)}`, 'Import successful');
    } catch (err) {
        await modalAlert(err.message || 'Import failed', 'Import failed');
    }
}

function initBackupControls() {
    exportNotesBtn?.addEventListener('click', () => exportArchive('user'));
    importNotesBtn?.addEventListener('click', () => importNotesInput?.click());
    importNotesInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) await handleUserImport(file);
    });

    exportSystemBtn?.addEventListener('click', () => exportArchive('system'));
    importSystemBtn?.addEventListener('click', () => importSystemInput?.click());
    importSystemInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) await handleSystemImport(file);
    });
}

// User Account Panel
userPanelBtn.onclick = () => {
    dashboardView.classList.add('hidden');
    userView.classList.remove('hidden');
    adminView.classList.add('hidden');
    loadAiSettingsForm(USER_AI_FORM);
};

closeUserBtn.onclick = () => {
    userView.classList.add('hidden');
    showDashboard();
};

// Admin Panel Logic
adminPanelBtn.onclick = () => {
    dashboardView.classList.add('hidden');
    adminView.classList.remove('hidden');
    userView.classList.add('hidden');
    loadAdminUsers();
    loadAiSettingsForm(ADMIN_AI_FORM);
};

closeAdminBtn.onclick = () => {
    adminView.classList.add('hidden');
    showDashboard();
};

async function loadAdminUsers() {
    const res = await apiFetch('api/admin.php');
    if (res.status === 403) return;
    const users = await res.json();
    if (!Array.isArray(users)) return;

    adminUsersList.innerHTML = users.map(u => {
        const isSelf = state.userId == u.id;
        const isSuspended = u.status === 'suspended';
        const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';

        return `
            <tr class="${isSuspended ? 'admin-user-suspended' : ''}">
                <td>
                    <div class="admin-user-email">${escapeHtml(u.email)}</div>
                    ${isSelf ? '<span class="admin-user-you">You</span>' : ''}
                </td>
                <td>
                    <span class="role-badge ${u.role === 'admin' ? 'role-badge-admin' : ''}">${escapeHtml(u.role)}</span>
                </td>
                <td>
                    <span class="status-badge ${isSuspended ? 'status-badge-suspended' : 'status-badge-active'}">
                        ${isSuspended ? 'Suspended' : 'Active'}
                    </span>
                </td>
                <td class="admin-user-joined">${escapeHtml(joined)}</td>
                <td>
                    <div class="admin-user-actions">
                        <button type="button" class="secondary-action" data-admin-action="reset_password" data-user-id="${u.id}" title="Reset password">
                            <i class="fa-solid fa-key"></i>
                            <span>Reset</span>
                        </button>
                        ${isSuspended ? `
                            <button type="button" class="secondary-action secondary-action-success" data-admin-action="activate" data-user-id="${u.id}" title="Activate user">
                                <i class="fa-solid fa-user-check"></i>
                                <span>Activate</span>
                            </button>
                        ` : `
                            <button type="button" class="secondary-action secondary-action-warn" data-admin-action="suspend" data-user-id="${u.id}" ${isSelf ? 'disabled' : ''} title="Suspend user">
                                <i class="fa-solid fa-user-slash"></i>
                                <span>Suspend</span>
                            </button>
                        `}
                        <button type="button" class="secondary-action secondary-action-danger" data-admin-action="delete" data-user-id="${u.id}" ${isSelf ? 'disabled' : ''} title="Delete user">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function adminUserAction(action, userId, userEmail = '') {
    if (action === 'reset_password') {
        await resetUserPassword(userId);
        return;
    }

    if (action === 'suspend') {
        const confirmed = await modalConfirm(
            `Suspend ${userEmail}? They will not be able to log in until reactivated.`,
            'Suspend user',
            'Suspend'
        );
        if (!confirmed) return;
        const res = await apiFetch('api/admin.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, action: 'suspend' })
        });
        const data = await res.json();
        if (data.success) {
            loadAdminUsers();
        } else {
            await modalAlert(data.error || 'Failed to suspend user', 'Error');
        }
        return;
    }

    if (action === 'activate') {
        const res = await apiFetch('api/admin.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, action: 'activate' })
        });
        const data = await res.json();
        if (data.success) {
            loadAdminUsers();
        } else {
            await modalAlert(data.error || 'Failed to activate user', 'Error');
        }
        return;
    }

    if (action === 'delete') {
        const confirmed = await modalConfirm(
            `Permanently delete ${userEmail}? All of their folders, notes, and images will be removed.`,
            'Delete user',
            'Delete'
        );
        if (!confirmed) return;
        const res = await apiFetch(`api/admin.php?id=${encodeURIComponent(userId)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadAdminUsers();
        } else {
            await modalAlert(data.error || 'Failed to delete user', 'Error');
        }
    }
}

function initAdminUserManagement() {
    adminUsersList?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-admin-action]');
        if (!btn || btn.disabled) return;
        const email = btn.closest('tr')?.querySelector('.admin-user-email')?.textContent?.trim() || '';
        adminUserAction(btn.dataset.adminAction, btn.dataset.userId, email);
    });
}

adminCreateUserForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('newAdminEmail').value.trim();
    const password = document.getElementById('newAdminPass').value;
    const role = document.getElementById('newAdminRole').value;

    const res = await apiFetch('api/admin.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
    });

    const data = await res.json();
    if (data.error) {
        await modalAlert(data.error, 'Error');
    } else {
        document.getElementById('newAdminEmail').value = '';
        document.getElementById('newAdminPass').value = '';
        await modalAlert(`User ${email} was added successfully.`, 'User added');
        loadAdminUsers();
    }
};

async function resetUserPassword(id) {
    const new_password = await modalPrompt('Reset password', 'Enter new password (min. 6 characters)');
    if (!new_password) return;
    if (new_password.length < 6) {
        await modalAlert('Password must be at least 6 characters.', 'Invalid password');
        return;
    }

    const res = await apiFetch('api/admin.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reset_password', new_password })
    });

    const data = await res.json();
    if (data.success) {
        await modalAlert('Password reset successfully.', 'Success');
    } else {
        await modalAlert(data.error || 'Failed to reset password', 'Error');
    }
}

// Expose for search result onclick
window.openPage = openPage;
window.deleteItem = deleteItem;
