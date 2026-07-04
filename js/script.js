let currentLang = 'ar';   
let activeScreen = 'welcome';  
let currentBookData = null;      
let selectedChapterId = null;  
let currentTextFilter = '';      
let currentLengthFilter = 'all';  
let currentBookKey = '';   

const SHORT_HADITH_WORD_LIMIT = 50;


function getChapterId(hadith) {
    if (!hadith) return undefined;
    if (hadith.chapter_id !== undefined) return hadith.chapter_id;
    if (hadith.chapterId !== undefined) return hadith.chapterId;
    return hadith.book_id;
}


function getChapterTitle(chapter, lang) {
    if (!chapter) return '';
    if (lang === 'ar') {
        return chapter.arabic || chapter.title_ar || chapter.name_ar || chapter.name || '';
    }
    return chapter.english || chapter.title_en || chapter.name_en || chapter.text_en || chapter.title || '';
}


function countWordsInText(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}


function matchesLengthFilter(text, lengthFilter) {
    if (lengthFilter === 'all' || !lengthFilter) return true;
    const wordCount = countWordsInText(text);
    if (lengthFilter === 'short') return wordCount < SHORT_HADITH_WORD_LIMIT;
    if (lengthFilter === 'long') return wordCount >= SHORT_HADITH_WORD_LIMIT;
    return true;
}


function renderSimpleMessage(container, message) {
    if (!container) return;
    container.innerHTML = `<p class="text-center text-gray-500 py-8 font-medium">${message}</p>`;
}

function renderEmptyState(container, message) {
    if (!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 w-full">
            <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-madinah-gold">
                <i class="fa-solid fa-folder-open text-2xl"></i>
            </div>
            <h4 class="font-bold text-lg text-madinah-dark">${message}</h4>
        </div>
    `;
}


function debounce(fn, delay = 300) {
    let timerId = null;
    return function debounced(...args) {
        clearTimeout(timerId);
        timerId = setTimeout(() => fn.apply(this, args), delay);
    };
}


const BOOK_DB_NAME = 'hadithBooksCache';
const BOOK_DB_VERSION = 1;
const BOOK_STORE_NAME = 'books';

let bookCacheDBPromise = null;

function openBookCacheDB() {
    if (bookCacheDBPromise) return bookCacheDBPromise;

    bookCacheDBPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB غير مدعومة '));
            return;
        }
        const request = indexedDB.open(BOOK_DB_NAME, BOOK_DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(BOOK_STORE_NAME)) {
                db.createObjectStore(BOOK_STORE_NAME, { keyPath: 'bookKey' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });

    return bookCacheDBPromise;
}

async function getCachedBookJSON(bookKey) {
    try {
        const db = await openBookCacheDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(BOOK_STORE_NAME, 'readonly');
            const store = tx.objectStore(BOOK_STORE_NAME);
            const request = store.get(bookKey);
            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('تعذر قراءة  الكتاب من IndexedDB:', bookKey, e);
        return null;
    }
}

async function setCachedBookJSON(bookKey, data) {
    try {
        const db = await openBookCacheDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(BOOK_STORE_NAME, 'readwrite');
            const store = tx.objectStore(BOOK_STORE_NAME);
            const request = store.put({ bookKey, data, cachedAt: Date.now() });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('تعذر حفظ  الكتاب بـ IndexedDB:', bookKey, e);
    }
}

async function fetchJSONWithRetry(url, { retries = 2, timeoutMs = 12000 } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            clearTimeout(timeoutId);
            lastError = err;
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}

const translations = {
    ar: {
        pageTitle: "منصة أنوار السنة - الصحاح الستة",
        brandName: "أَنْوَارُ السُّنَّةِ",
        brandSub: "موسوعة الصحاح الستة التفاعلية",
        navHome: "الرئيسية",
        heroBadge: "أنوار نبوية مأثورة",
        heroTitle: "«أنوار النبوة بين يديك، لتقتفي الأثر»",
        heroHadith: `"قَالَ رَسُولُ اللَّهِ ﷺ: نَضَّرَ اللَّهُ امْرَأً سَمِعَ مَقَالَتِي فَوَعَاهَا وَحَفِظَهَا وَبَلَّغَهَا"`,
        heroHadithRef: "— رواه أبو داود و الترمذي",
        heroDesc: "مرحباً بك في منصة أنوار السنة؛ وجهتك الرائدة للبحث وتصفح أحاديث الصحاح الستة بروح مستوحاة من رحاب الروضة الشريفة. اضغط على أي كتاب لتبدأ رحلتك المباركة.",
        searchTitle: "البحث العام الذكي في جميع دواوين الصحاح",
        globalSearchPlaceholder: "ابحث الآن في متون ورواة الأحاديث في جميع الكتب الستة...",
        booksSectionTitle: "دَوَاوِينُ الصِّحَاحِ السِّتَّةِ",
        booksSectionDesc: "اختر الكتاب المبارك الذي تود تصفحه والبحث في تبويباته",
        totalHadithsLabel: "إجمالي الأحاديث",

        bukhariBadge: "الجامع الصحيح",
        bukhariTitle: "صَحِيحُ الْبُخَارِيِّ",
        bukhariAuthor: "للإمام محمد بن إسماعيل البخاري",
        bukhariDesc: "أصح كتاب بعد كتاب الله عز وجل، التزم فيه صاحبه بأعلى درجات الصحة في النقل والرواية.",
        bukhariBooksCount: "97 كتابًا",
        bukhariHadithsCount: "7277 حديثًا",
        
        muslimBadge: "الجامع الصحيح",
        muslimTitle: "صَحِيحُ مُسْلِمٍ",
        muslimAuthor: "للإمام مسلم بن الحجاج القشيري",
        muslimDesc: "قرين البخاري في الصحة والمكانة، تميز بترتيبه الفريد وجمع طرق الحديث في موضع واحد.",
        muslimBooksCount: "56 كتابًا",
        muslimHadithsCount: "6084 حديثًا",
        
        tirmidhiBadge: "السنن والعلل",
        tirmidhiTitle: "سُنَنُ التِّرْمِذِيِّ",
        tirmidhiAuthor: "للإمام محمد بن عيسى الترمذي",
        tirmidhiDesc: "يتميز بذكر فقه الأحاديث ومذاهب الصحابة والتابعين، وبيان درجة الأحاديث من الصحة والضعف.",
        tirmidhiBooksCount: "49 كتابًا",
        tirmidhiHadithsCount: "3956 حديثًا",
        
        nasaiBadge: "السنن الصغرى",
        nasaiTitle: "سُنَنُ النَّسَائِيِّ",
        nasaiAuthor: "للإمام أحمد بن شعيب النسائي",
        nasaiDesc: "أقل السنن حديثاً ضعيفاً ورجالاً مجروحين، امتاز بدقة تراجم الأبواب وعمق الاستنباط الفقهي.",
        nasaiBooksCount: "51 كتابًا",
        nasaiHadithsCount: "5758 حديثًا",
        
        abudawudBadge: "السنن الفقهية",
        abudawudTitle: "سُنَنُ أَبِي دَاوُدَ",
        abudawudAuthor: "للإمام سليمان بن الأشعث السجستاني",
        abudawudDesc: "صُنِّف خصيصاً لجمع أحاديث الأحكام والفقه التي يعتمد عليها المجتهدون وأصحاب المذاهب.",
        abudawudBooksCount: "43 كتابًا",
        abudawudHadithsCount: "5274 حديثًا",
        
        ibnmajahBadge: "السنن الجامعة",
        ibnmajahTitle: "سُنَنُ ابْنِ مَاجَهْ",
        ibnmajahAuthor: "للإمام محمد بن يزيد بن ماجه",
        ibnmajahDesc: "يتميز بدقة الترتيب والتصنيف، وكثرة الفوائد والزوائد على الكتب الخمسة السابقة.",
        ibnmajahBooksCount: "37 كتابًا",
        ibnmajahHadithsCount: "4341 حديثًا",

        backToHome: "العودة للرئيسية",
        chaptersListTitle: "قائمة الأبواب والكتب الفقهية",
        bookSearchPlaceholder: "ابحث في كل أحاديث هذا الكتاب وجميع أبوابه...",
        backToChapters: "العودة لقائمة الأبواب",
        hadithSearchPlaceholder: "ابحثي في المتن، الراوي، أو بالكلمة (مثال: نية، صلاة، وضوء)...",
        filterAll: "كل الأحاديث",
        filterShort: "القصيرة فقط",
        filterLong: "المطوّلة",
        footerAbout: "مكتبة إلكترونية شاملة مخصصة لخدمة وعرض أحاديث الصحاح الستة بيسر وسهولة، بمميزات بحث تفاعلية تناسب طلاب العلم والعموم.",
        footerLinksTitle: "روابط ملهمة",
        link1: "سلسلة الرواة والأسانيد",
        link2: "الكتب المسموعة",
        link3: "المنهجية والمصادر",
        footerContactTitle: "تواصل معنا",
        footerCopyright: "2026 منصة أنوار السنة. جميع الحقوق لكل مسلم.",
        modalTitle: "تخصيص نتائج البحث",
        modalReset: "إعادة ضبط",
        modalScopeLabel: "نطاق البحث (الصحاح):",
        modalScopeDesc: "اضغطي مع سحب أو Ctrl لتحديد أكثر من كتاب",
        modalLengthLabel: "طول المتن النبوي:",
        lenAll: "الكل",
        lenShort: "القصيرة",
        lenLong: "المطولة",
        modalChapterLabel: "البحث داخل باب فقهي معين:",
        modalChapterPlaceholder: "مثال: علم، إيمان، جهاد...",
        optBukhari: "صحيح البخاري",
        optMuslim: "صحيح مسلم",
        optTirmidhi: "سنن الترمذي",
        optNasai: "سنن النسائي",
        optAbudawud: "سنن أبي داود",
        optIbnmajah: "سنن ابن ماجه"
    },
    en: {
        pageTitle: "Anwar Al-Sunnah Platform - The Six Books of Hadith",
        brandName: "ANWAR AL-SUNNAH",
        brandSub: "Interactive Encyclopedia of the Six Authentic Hadith Books",
        navHome: "Home",
        heroBadge: "Prophetic Lights",
        heroTitle: "«The Lights of Prophethood in Your Hands, to Follow the Footsteps»",
        heroHadith: `"The Messenger of Allah ﷺ said: May Allah brighten a man who hears my saying, understands it, guards it, and conveys it."`,
        heroHadithRef: "— Narrated by Abu Dawud and Al-Tirmidhi",
        heroDesc: "Welcome to Anwar Al-Sunnah Platform; your premier destination for searching and browsing the Hadiths of the Sahih Sittah, inspired by the serene essence of the Prophet's Holy Rawdah. Click on any book to begin your blessed journey.",
        booksSectionTitle: "THE SIX AUTHENTIC HADITH COLLECTIONS",
        booksSectionDesc: "Choose the blessed book you wish to browse and search its chapters",
        totalHadithsLabel: "Total Hadiths",
        
        bukhariBadge: "Al-Jami' al-Sahih",
        bukhariTitle: "SAHIH AL-BUKHARI",
        bukhariAuthor: "By Imam Muhammad bin Ismail Al-Bukhari",
        bukhariDesc: "The most authentic book after the Book of Allah Almighty, in which the author committed to the highest degrees of authenticity in transmission.",
        bukhariBooksCount: "97 Books",
        bukhariHadithsCount: "7277 Hadiths",
        
        muslimBadge: "Al-Jami' al-Sahih",
        muslimTitle: "SAHIH AL-MSULIM",
        muslimAuthor: "By Imam Muslim bin Al-Hajjaj Al-Qushayri",
        muslimDesc: "The counterpart of Al-Bukhari in authenticity and status, distinguished by its unique arrangement and gathering of Hadith routes in one place.",
        muslimBooksCount: "56 Books",
        muslimHadithsCount: "6084 Hadiths",
        
        tirmidhiBadge: "Al-Sunan & Al-Ilal",
        tirmidhiTitle: "SUNAN AL-TIRMIDHI",
        tirmidhiAuthor: "By Imam Muhammad bin Isa Al-Tirmidhi",
        tirmidhiDesc: "Distinguished by mentioning the jurisprudence of Hadiths, views of Sahabah and Tabi'un, and clarifying Hadith grading (authentic/weak).",
        tirmidhiBooksCount: "49 Books",
        tirmidhiHadithsCount: "3956 Hadiths",
        
        nasaiBadge: "Al-Sunan Al-Sughra",
        nasaiTitle: "SUNAN AL-NASAI",
        nasaiAuthor: "By Imam Ahmad bin Shu'ayb Al-Nasai",
        nasaiDesc: "Contains the fewest weak Hadiths and criticized narrators among Sunan, noted for precise chapter titles and deep Fiqh deduction.",
        nasaiBooksCount: "51 Books",
        nasaiHadithsCount: "5758 Hadiths",
        
        abudawudBadge: "Fiqh Sunan",
        abudawudTitle: "SUNAN ABU DAWUD",
        abudawudAuthor: "By Imam Sulayman bin Al-Ash'ath Al-Sijistani",
        abudawudDesc: "Specifically compiled to collect Hadiths of rulings and Fiqh upon which independent scholars and legal schools rely.",
        abudawudBooksCount: "43 Books",
        abudawudHadithsCount: "5274 Hadiths",
        
        ibnmajahBadge: "Al-Sunan Al-Jami'ah",
        ibnmajahTitle: "SUNAN IBN MAJAH",
        ibnmajahAuthor: "By Imam Muhammad bin Yazid bin Majah",
        ibnmajahDesc: "Characterized by precise arrangement, classification, and a wealth of unique benefits and additions over the previous five books.",
        ibnmajahBooksCount: "37 Books",
        ibnmajahHadithsCount: "4341 Hadiths",

        backToHome: "Back to Home",
        chaptersListTitle: "List of Chapters and Jurisprudence Books",
        bookSearchPlaceholder: "Search all hadiths of this book across all its chapters...",
        backToChapters: "Back to Chapters List",
        hadithSearchPlaceholder: "Search in text, narrator, or keyword (e.g., intention, prayer)...",
        filterAll: "All Hadiths",
        filterShort: "Short Only",
        filterLong: "Detailed",
        footerAbout: "A comprehensive digital library dedicated to serving and displaying the Hadiths of the Sahih Sittah with ease, featuring interactive search tools suitable for students of knowledge and the general public.",
        footerLinksTitle: "Inspiring Links",
        link1: "Chain of Narrators & Sanad",
        link2: "Audio Books",
        link3: "Methodology & Sources",
        footerContactTitle: "Contact Us",
        footerCopyright: "2026 Anwar Al-Sunnah Platform. All rights reserved for every Muslim.",
        searchTitle: "Smart Global Search Across All Hadith Databases",
        globalSearchPlaceholder: "Search now in texts and narrators across all six books...",
        modalTitle: "Customize Search Results",
        modalReset: "Reset Filters",
        modalScopeLabel: "Search Scope (Books):",
        modalScopeDesc: "Hold Ctrl or drag to select multiple books",
        modalLengthLabel: "Hadith Text Length:",
        lenAll: "All",
        lenShort: "Short",
        lenLong: "Long",
        modalChapterLabel: "Search inside a specific chapter:",
        modalChapterPlaceholder: "e.g., Knowledge, Faith, Jihad...",
        optBukhari: "Sahih al-Bukhari",
        optMuslim: "Sahih Muslim",
        optTirmidhi: "Sunan al-Tirmidhi",
        optNasai: "Sunan al-Nasa'i",
        optAbudawud: "Sunan Abi Dawud",
        optIbnmajah: "Sunan Ibn Majah"
    }
};
function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    
    const htmlTag = document.documentElement;
    htmlTag.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
    htmlTag.setAttribute('lang', currentLang);
    
    updateStaticUI();
    
    if (activeScreen === 'chapters' && currentBookData) {
        const t = translations[currentLang];
        document.getElementById('active-book-title').innerText = t[`${currentBookKey}Title`] || '';
        document.getElementById('active-book-author').innerText = t[`${currentBookKey}Author`] || '';
        const countKey = `${currentBookKey}HadithsCount`;
        document.getElementById('active-book-count').innerText = t[countKey] || '';
        renderChapters(currentBookData.chapters);
        
        const bookSearchInput = document.getElementById('book-search');
        if (bookSearchInput && bookSearchInput.value.trim() !== '' && typeof performBookSearch === 'function') {
            performBookSearch();
        }
    } 
    else if (activeScreen === 'hadiths' && selectedChapterId) {
        renderHadiths(selectedChapterId);
        
        const chapter = currentBookData.chapters.find(c => c.id == selectedChapterId);
        if (chapter) {
            const translatedChapterTitle = getChapterTitle(chapter, currentLang);
                
            const chapterSpan = document.getElementById('breadcrumb-chapter');
            const hadithScreenChapter = document.getElementById('hadith-screen-chapter');
            
            if (chapterSpan) chapterSpan.innerText = translatedChapterTitle;
            if (hadithScreenChapter) hadithScreenChapter.innerText = translatedChapterTitle;
        }
    }

    const backToTopTooltip = document.getElementById('back-to-top-tooltip');
    if (backToTopTooltip) {
        backToTopTooltip.innerText = currentLang === 'ar' ? 'العودة للأعلى' : 'Back to Top';
    }
}

 function updateStaticUI() {
    const t = translations[currentLang];
    
    const langBtn = document.getElementById('lang-btn-text');
    if (langBtn) langBtn.innerText = currentLang === 'ar' ? 'English' : 'العربية';
    
    const breadcrumbs = document.getElementById('nav-breadcrumbs');
    if (breadcrumbs) {
        const homeSpan = breadcrumbs.querySelector('span:first-child');
        if (homeSpan) homeSpan.innerText = t.navHome;
        
        if (currentBookKey) {
            const bBook = document.getElementById('breadcrumb-book');
            if (bBook) bBook.innerText = t[`${currentBookKey}Title`];
        }
    }

    const hadithScreenBook = document.getElementById('hadith-screen-book');
    if (hadithScreenBook && currentBookKey) {
        hadithScreenBook.innerText = t[`${currentBookKey}Title`];
    }
    
    const elementsToTranslate = document.querySelectorAll('[data-key]');
    elementsToTranslate.forEach(element => {
        const key = element.getAttribute('data-key');
        if (t[key]) {
            if (element.tagName === 'INPUT') element.placeholder = t[key];
            else element.innerHTML = t[key];
        }
    });
const allHadithsBtn = document.getElementById('all-hadiths-btn');
if (allHadithsBtn) {
    allHadithsBtn.innerText = currentLang === 'ar' ? 'كل الأحاديث' : 'All Hadiths';
}
}
function showScreen(screenId) {
    activeScreen = screenId;
    const targetScreens = ['screen-welcome', 'screen-chapters', 'screen-hadiths'];
    
    targetScreens.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === `screen-${screenId}`) {
                element.classList.remove('hidden');
                element.classList.add('block');
            } else {
                element.classList.add('hidden');
                element.classList.remove('block');
            }
        }
    });
    
    const breadcrumbs = document.getElementById('nav-breadcrumbs');
    const bookSpan = document.getElementById('breadcrumb-book');
    const divider = document.getElementById('breadcrumb-divider');
    const chapterSpan = document.getElementById('breadcrumb-chapter');
    
    if (screenId === 'welcome') {
        if (breadcrumbs) breadcrumbs.classList.add('hidden');
        if (bookSpan) bookSpan.innerText = "";
        if (chapterSpan) chapterSpan.innerText = "";
        if (divider) divider.classList.add('hidden');
    } else {

        if (breadcrumbs) breadcrumbs.classList.remove('hidden');
        
        if (screenId === 'chapters') {
            if (divider) divider.classList.add('hidden');
            if (chapterSpan) chapterSpan.innerText = "";
        }
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function selectBook(bookKey) {
    currentBookKey = bookKey;
    
    const bookTitleText = translations[currentLang][`${bookKey}Title` || ''];
    const bookAuthorText = translations[currentLang][`${bookKey}Author` || ''];
    
    document.getElementById('active-book-title').innerText = bookTitleText;
    document.getElementById('active-book-author').innerText = bookAuthorText;
    document.getElementById('hadith-screen-book').innerText = bookTitleText;

    const countKey = `${bookKey}HadithsCount`;
    document.getElementById('active-book-count').innerText = translations[currentLang][countKey] || '';
    
    const breadcrumbBook = document.getElementById('breadcrumb-book');
    if (breadcrumbBook) {
        breadcrumbBook.innerText = bookTitleText;
        breadcrumbBook.classList.remove('hidden');
    }

    const jsonFile = `data/${bookKey}.json`;

    const applyBookData = (data) => {
        currentBookData = data;
        selectedChapterId = null; 
        
        const bookSearchInput = document.getElementById('book-search');
        const bookSearchResults = document.getElementById('book-search-results');
        if (bookSearchInput) bookSearchInput.value = '';
        if (bookSearchResults) { bookSearchResults.classList.add('hidden'); bookSearchResults.innerHTML = ''; }
        updateStaticUI();

        renderChapters(currentBookData.chapters);
        showScreen('chapters');
    };

    const cachedData = await getCachedBookJSON(bookKey);
    if (cachedData) {
        applyBookData(cachedData);
        fetchJSONWithRetry(jsonFile, { retries: 1 })
            .then(freshData => setCachedBookJSON(bookKey, freshData))
            .catch(() => {});
        return;
    }

    const chaptersGrid = document.getElementById('chapters-grid');
    showScreen('chapters');
    if (chaptersGrid) {
        const loadingMsg = currentLang === 'ar' ? 'جاري تحميل الكتاب...' : 'Loading book...';
        chaptersGrid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center gap-3 py-12 text-madinah-dark">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-madinah-gold"></i>
                <p class="text-sm font-medium">${loadingMsg}</p>
            </div>
        `;
    }

    fetchJSONWithRetry(jsonFile)
        .then(data => {
            setCachedBookJSON(bookKey, data);
            applyBookData(data);
        })
        .catch(error => {
            console.error(`Error fetching ${bookKey} data:`, error);
            if (chaptersGrid) {
                const failMsg = currentLang === 'ar' 
                    ? 'فشل تحميل الكتاب. تأكد من اتصال الإنترنت وحاول مرة أخرى.' 
                    : 'Failed to load the book. Check your internet connection and try again.';
                const retryLabel = currentLang === 'ar' ? 'إعادة المحاولة' : 'Retry';
                chaptersGrid.innerHTML = `
                    <div class="col-span-full flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <i class="fa-solid fa-triangle-exclamation text-2xl text-red-400"></i>
                        <p class="text-sm font-medium text-madinah-dark">${failMsg}</p>
                        <button onclick="selectBook('${bookKey}')" class="mt-2 px-5 py-2 bg-madinah-green text-white rounded-lg text-sm font-bold hover:opacity-90 transition">
                            ${retryLabel}
                        </button>
                    </div>
                `;
            }
        });
}
function renderChapters(chapters) {
    const chaptersGrid = document.getElementById('chapters-grid');
    if (!chaptersGrid) return;
    
    chaptersGrid.innerHTML = '';
    if (!chapters) return;
    
    chaptersGrid.className = "grid grid-cols-1 md:grid-cols-2 gap-4";
    chapters.forEach((chapter, idx) => {
        const chapCard = document.createElement('div');
        
        const isAr = (currentLang === 'ar');
        
        const cardDirectionClass = isAr ? "flex-row text-right" : "flex-row text-left";
        const badgeDirectionClass = isAr ? "flex-row" : "flex-row-reverse";
        const arrowIcon = isAr ? "fa-chevron-left" : "fa-chevron-right";

    chapCard.className = `bg-white rounded-xl border border-gray-100 p-5 hover:border-madinah-gold hover:shadow-md transition-all duration-300 cursor-pointer flex justify-between items-center group ${cardDirectionClass}`;
        chapCard.onclick = () => {
            selectedChapterId = chapter.id;
            
            const breadcrumbDivider = document.getElementById('breadcrumb-divider');
            const breadcrumbChapter = document.getElementById('breadcrumb-chapter');
            const hadithScreenChapter = document.getElementById('hadith-screen-chapter');
            
            const chapterTitle = getChapterTitle(chapter, currentLang);
                
            if (breadcrumbDivider) breadcrumbDivider.classList.remove('hidden');
            if (breadcrumbChapter) breadcrumbChapter.innerText = chapterTitle;
            if (hadithScreenChapter) hadithScreenChapter.innerText = chapterTitle;
            
            currentTextFilter = '';
            currentLengthFilter = 'all';
            const searchInput = document.getElementById('hadith-search');
            if (searchInput) searchInput.value = '';
            
            resetFilterButtons();
            renderHadiths(chapter.id);
            showScreen('hadiths');
        };
        
        const chapterTitle = getChapterTitle(chapter, currentLang);
            
        const chapterLabel = isAr ? `الباب ${idx + 1}` : `Chapter ${idx + 1}`;
        
        let finalCount = 0;
        try {
            if (currentBookData && Array.isArray(currentBookData.hadiths)) {
                finalCount = currentBookData.hadiths.filter(h => getChapterId(h) == chapter.id).length;
            }
        } catch (e) {
            console.warn("حدث خطأ  أثناء حساب الأعداد وتم تجاوزه بأمان:", e);
            finalCount = chapter.count || 0; 
        }

        const countLabel = isAr ? `${finalCount} أحاديث` : `${finalCount} Hadiths`;

        chapCard.innerHTML = `
            <div class="space-y-1">
                <span class="text-xs text-madinah-gold font-bold block">${chapterLabel}</span>
                <h4 class="font-bold text-madinah-dark group-hover:text-madinah-green transition-colors text-base md:text-lg">${chapterTitle}</h4>
            </div>
            <div class="flex items-center gap-3 ${badgeDirectionClass}">
                <span class="bg-madinah-cream px-3 py-1.5 text-xs font-semibold text-madinah-green border border-madinah-green/20 rounded-lg whitespace-nowrap">
                    ${countLabel}
                </span>
                <i class="fa-solid ${arrowIcon} text-gray-300 group-hover:text-madinah-gold transition-colors text-xs"></i>
            </div>
        `;
        
        chaptersGrid.appendChild(chapCard);
    });
}

function getHadithText(hadith, lang) {
    if (lang === 'ar') {

        return hadith.arabic || '';
    } else {
        if (hadith.english && typeof hadith.english === 'object') {
            return hadith.english.text || '';
        }
        return hadith.english || '';
    }
}

function getHadithNarrator(hadith, lang) {
    if (lang === 'ar') {
        return ''; 
    } else {
        if (hadith.english && typeof hadith.english === 'object') {
            return hadith.english.narrator || '';
        }
        return '';
    }
}

function renderHadiths(chapterId) {
    const container = document.getElementById('hadith-cards-container');
    const countBadge = document.getElementById('hadith-count-badge');
    if (!container) return;
    
    container.innerHTML = '';
    if (!currentBookData || !currentBookData.hadiths) return;
    
    let hadithList = currentBookData.hadiths.filter(h => getChapterId(h) == chapterId);

    hadithList.sort((a, b) => (a.id || 0) - (b.id || 0));
    const chapterHadithNumbers = new Map();
    hadithList.forEach((h, idx) => {
        chapterHadithNumbers.set(h, idx + 1);
    });
    
    if (currentTextFilter.trim() !== '') {
        const query = cleanArabicText(currentTextFilter); 
        hadithList = hadithList.filter(h => {
            const textToSearch = cleanArabicText(getHadithText(h, currentLang)); 
            const narratorToSearch = getHadithNarrator(h, currentLang).toLowerCase();
            return textToSearch.includes(query) || narratorToSearch.includes(query);
        });
    }
        
    hadithList = hadithList.filter(h => matchesLengthFilter(getHadithText(h, currentLang), currentLengthFilter));
    
    if (countBadge) {
        if (currentLang === 'ar') {
            countBadge.textContent = `عدد النتائج: ${hadithList.length}`;
        } else {
            countBadge.textContent = `Results Found: ${hadithList.length}`;
        }
    }
    
    if (hadithList.length === 0) {
        const noResultsMsg = currentLang === 'ar' ? 'لم نعثر على أي نتائج مطابقة' : 'No matching results found';
        renderEmptyState(container, noResultsMsg);
        return;
    }
    
    hadithList.forEach(hadith => {
        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-sm hover:shadow-md transition-all";
        
        let text = getHadithText(hadith, currentLang);
        let narrator = getHadithNarrator(hadith, currentLang);
        
        if (currentTextFilter.trim() !== '') {
            text = highlightText(text, currentTextFilter);
            if (narrator) narrator = highlightText(narrator, currentTextFilter);
        }

        const alignClass = currentLang === 'ar' ? 'text-right font-serif' : 'text-left font-sans';
        const hadithNum = chapterHadithNumbers.get(hadith) || hadith.num || hadith.id || '';
        
        let cardHTML = `
            <div class="flex justify-between items-center border-b border-gray-100 pb-4">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-full border border-gray-200 bg-madinah-gold text-white text-xs font-bold flex items-center justify-center">#${hadithNum}</span>
                </div>
            </div>
            
            <p class="text-xl leading-relaxed text-madinah-dark ${alignClass}">${text}</p> `;

        if (narrator && currentLang !== 'ar') {
    cardHTML += `
        <div class="pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-1.5">
            <i class="fa-solid fa-user text-madinah-gold"></i> 
            <span><strong>Narrator:</strong> ${narrator}</span>
        </div>
    `;
    }
        card.innerHTML = cardHTML;
        container.appendChild(card);
    });
}

function setFilter(filterType) {
    currentLengthFilter = filterType;
    
    resetFilterButtons();
    const activeBtn = document.getElementById(`filter-btn-${filterType}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
        if (selectedChapterId !== null) {
        renderHadiths(selectedChapterId);
    }
}

function resetFilterButtons() {
    const buttons = ['all', 'short', 'long'];
    buttons.forEach(type => {
        const btn = document.getElementById(`filter-btn-${type}`);
        if (btn) {
            btn.classList.remove('active');
        }
    });
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    
    const themeBtn = document.querySelector('header button[onclick="toggleTheme()"]');
    if (themeBtn) {
        const icon = themeBtn.querySelector('i');
        if (document.body.classList.contains('dark-theme')) {
            if (icon) icon.className = 'fa-solid fa-sun text-lg text-amber-400';
        } else {
            if (icon) icon.className = 'fa-solid fa-moon text-lg text-madinah-gold';
        }
    }
    
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

document.addEventListener('DOMContentLoaded', () => {
    updateStaticUI();
    
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        const themeBtn = document.querySelector('header button[onclick="toggleTheme()"]');
        if (themeBtn) {
            const icon = themeBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-sun text-lg text-amber-400';
        }
    }
});

function initBackToTopButton() {
   
    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'back-to-top-btn';
    backToTopBtn.className = 'fixed bottom-8 start-8 z-50 w-12 h-12 rounded-full bg-madinah-gold text-white shadow-lg hover:scale-110 transition-all duration-300 flex items-center justify-center opacity-0 invisible transform translate-y-4';    backToTopBtn.innerHTML = '<i class="fa-solid fa-arrow-up text-xl"></i>';
    backToTopBtn.setAttribute('aria-label', 'Back to top');
    

    const tooltip = document.createElement('span');
    tooltip.className = 'absolute -top-8 start-0 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 transition-opacity duration-200 whitespace-nowrap pointer-events-none';    tooltip.id = 'back-to-top-tooltip';
    tooltip.innerText = currentLang === 'ar' ? 'العودة للأعلى' : 'Back to Top';
    backToTopBtn.appendChild(tooltip);
    
    
    backToTopBtn.addEventListener('mouseenter', () => {
        tooltip.classList.add('opacity-100');
    });
    backToTopBtn.addEventListener('mouseleave', () => {
        tooltip.classList.remove('opacity-100');
    });
    
    document.body.appendChild(backToTopBtn);
    
    
    let isVisible = false;
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY || window.pageYOffset;
        const shouldShow = scrollY > 900;
        
        if (shouldShow && !isVisible) {
            backToTopBtn.classList.remove('opacity-0', 'invisible', 'translate-y-4');
            backToTopBtn.classList.add('opacity-100', 'visible', 'translate-y-0');
            isVisible = true;
        } else if (!shouldShow && isVisible) {
            backToTopBtn.classList.add('opacity-0', 'invisible', 'translate-y-4');
            backToTopBtn.classList.remove('opacity-100', 'visible', 'translate-y-0');
            isVisible = false;
        }
    });
    
    
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackToTopButton);
} else {
    initBackToTopButton();
}