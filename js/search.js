let globalFilteredResults = []; 
let globalCurrentPage = 1;      
const globalItemsPerPage = 30;  

window.globalAllHadiths = [];
window.globalAllChapters = [];

function cleanArabicText(text) {
    if (!text) return '';
    return text
        .replace(/[\u064B-\u065F]/g, "") 
        .replace(/[أإآأ]/g, "ا")        
        .replace(/ة/g, "ه")             
        .trim()
        .toLowerCase();
}

function highlightText(text, query) {
    if (!text || !query) return text;
    try {
        const cleanQuery = query.trim();
        if (!cleanQuery) return text;
        const diacritics = "[\\u064B-\u065F\\u0670]*";
        let regexString = cleanQuery.split("").map(char => {
            if (/[اأإآأ]/.test(char)) return "[اأإآأ]" + diacritics;
            if (/[ةه]/.test(char)) return "[ةه]" + diacritics;
            return char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + diacritics;
        }).join("");
        const regex = new RegExp(`(${regexString})`, 'gi');
        return text.replace(regex, '<mark class="bg-yellow-200 text-black px-1 rounded">$1</mark>');
    } catch (e) { return text; }
}

async function performGlobalSearch() {
    const inputField = document.getElementById('global-search');
    const container = document.getElementById('hadiths-container'); 
    if (!inputField || !container) return;

    const rawQuery = inputField.value.trim();

    if (rawQuery === "") {
        container.innerHTML = '';
        removeGlobalPagination();
        return;
    }

    if (rawQuery.length < 3) {
        const warningMsg = currentLang === 'ar' ? 'اكتب 3 حروف أو أكثر للبحث...' : 'Type 3 or more characters to search...';
        container.innerHTML = `<p class="text-center text-gray-400 py-4 text-xs font-medium">${warningMsg}</p>`;
        removeGlobalPagination();
        return;
    }

    const books = ['bukhari', 'muslim', 'tirmidhi', 'ibnmajah', 'nasai', 'abudawud'];

    if (window.globalAllHadiths.length === 0) {
        window.globalAllChapters = []; 
        
        const loadingMsg = currentLang === 'ar' ? 'جاري  البحث  ...' : 'Search in progress...';
        container.innerHTML = `<p class="text-center text-gray-400 py-4 text-xs font-medium">${loadingMsg}</p>`;

        for (let book of books) {
            try {
                let data = null;

                if (typeof currentBookKey !== 'undefined' && currentBookKey === book && typeof currentBookData !== 'undefined' && currentBookData) {
                    data = currentBookData;
                } else {
                    const response = await fetch(`data/${book}.json`);
                    if (!response.ok) continue;
                    data = await response.json();
                }

                let bookTitleAr = '';
                let bookTitleEn = '';
                if (data.metadata) {
                    if (data.metadata.arabic && data.metadata.arabic.title) bookTitleAr = data.metadata.arabic.title;
                    if (data.metadata.english && data.metadata.english.title) bookTitleEn = data.metadata.english.title;
                }
                
                if (!bookTitleAr) {
                    if (book === 'bukhari') bookTitleAr = 'صحيح البخاري';
                    else if (book === 'muslim') bookTitleAr = 'صحيح مسلم';
                    else if (book === 'tirmidhi') bookTitleAr = 'سنن الترمذي';
                    else if (book === 'nasai') bookTitleAr = 'سنن النسائي';
                    else if (book === 'ibnmajah') bookTitleAr = 'سنن ابن ماجه';
                    else bookTitleAr = 'سنن أبي داود';
                }
                
                if (!bookTitleEn) {
                    if (book === 'bukhari') bookTitleEn = 'Sahih al-Bukhari';
                    else if (book === 'muslim') bookTitleEn = 'Sahih Muslim';
                    else if (book === 'tirmidhi') bookTitleEn = 'Sunan al-Tirmidhi';
                    else if (book === 'nasai') bookTitleEn = 'Sunan al-Nasa\'i';
                    else if (book === 'ibnmajah') bookTitleEn = 'Sunan Ibn Majah';
                    else bookTitleEn = 'Sunan Abi Dawud';
                }

                if (data.chapters) {
                    const mappedChapters = data.chapters.map(c => ({ ...c, globalBookKey: book }));
                    window.globalAllChapters.push(...mappedChapters);
                }
                
                let rawHadiths = data.hadiths || (Array.isArray(data) ? data : []);

                if (rawHadiths.length > 0) {
                    const mapped = rawHadiths.map(h => ({
                        ...h,
                        globalBookKey: book,
                        globalBookTitleAr: bookTitleAr,
                        globalBookTitleEn: bookTitleEn
                    }));
                    window.globalAllHadiths.push(...mapped);
                }
            } catch (error) {
                console.error(`خطأ في معالجة بيانات كتاب ${book}:`, error);
            }
        }
    }

    if (window.globalAllHadiths.length === 0) {
        const errorMsg = currentLang === 'ar' ? 'لم نتمكن من تحميل البيانات.' : 'Failed to load data.';
        container.innerHTML = `<p class="text-center text-red-400 py-4 text-xs font-medium">${errorMsg}</p>`;
        return;
    }

    globalFilteredResults = [];
    if (currentLang === 'ar') {
        const searchQuery = cleanArabicText(rawQuery);
        globalFilteredResults = window.globalAllHadiths.filter(hadith => {
            const textArabic = hadith.arabic ? cleanArabicText(hadith.arabic) : '';
            const bookTitleArabic = hadith.globalBookTitleAr ? cleanArabicText(hadith.globalBookTitleAr) : '';

            let chapterTitleArabic = '';
            if (window.globalAllChapters && window.globalAllChapters.length > 0) {
                const currentChapter = window.globalAllChapters.find(c => c.id == (hadith.chapter_id ?? hadith.chapterId) && c.globalBookKey === hadith.globalBookKey);
                if (currentChapter) chapterTitleArabic = cleanArabicText(currentChapter.arabic || currentChapter.title_ar || currentChapter.name_ar || '');
            }

            return textArabic.includes(searchQuery) ||
                bookTitleArabic.includes(searchQuery) ||
                chapterTitleArabic.includes(searchQuery);
        });
    } else {
        const searchQuery = rawQuery.toLowerCase();
        globalFilteredResults = window.globalAllHadiths.filter(hadith => {
            const textEnglish = getHadithText(hadith, 'en').toLowerCase();
            const narratorEnglish = getHadithNarrator(hadith, 'en').toLowerCase();
            const bookTitleEnglish = hadith.globalBookTitleEn ? hadith.globalBookTitleEn.toLowerCase() : '';

            let chapterTitleEnglish = '';
            if (window.globalAllChapters && window.globalAllChapters.length > 0) {
                const currentChapter = window.globalAllChapters.find(c => c.id == (hadith.chapter_id ?? hadith.chapterId) && c.globalBookKey === hadith.globalBookKey);
                if (currentChapter) chapterTitleEnglish = (currentChapter.english || currentChapter.title_en || currentChapter.name_en || '').toLowerCase();
            }

            return textEnglish.includes(searchQuery) ||
                narratorEnglish.includes(searchQuery) ||
                bookTitleEnglish.includes(searchQuery) ||
                chapterTitleEnglish.includes(searchQuery);
        });
    }

    globalCurrentPage = 1;
    displayGlobalPage(globalCurrentPage, rawQuery);
}

function displayGlobalPage(page, query) {
    const container = document.getElementById('hadiths-container');
    if (!container) return;

    container.innerHTML = '';

    if (globalFilteredResults.length === 0) {
       if( currentLang === 'ar') {
            container.innerHTML = `
                <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 w-full">
                    <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-madinah-gold">
                        <i class="fa-solid fa-folder-open text-2xl"></i>
                    </div>
                    <h4 class="font-bold text-lg text-madinah-dark">لم نعثر على أي نتائج مطابقة</h4>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 w-full">
                    <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-madinah-gold">
                        <i class="fa-solid fa-folder-open text-2xl"></i>
                    </div>
                    <h4 class="font-bold text-lg text-madinah-dark">No matching results found</h4>
                </div>
            `;
        }
        return;
        removeGlobalPagination();
        
    }

    const startIndex = (page - 1) * globalItemsPerPage;
    const endIndex = startIndex + globalItemsPerPage;
    const pageItems = globalFilteredResults.slice(startIndex, endIndex); 

    let htmlString = "";

    pageItems.forEach(hadith => {
        let chapterTitle = '';
        if (window.globalAllChapters && window.globalAllChapters.length > 0) {
            const currentChapter = window.globalAllChapters.find(c => c.id == (hadith.chapter_id ?? hadith.chapterId) && c.globalBookKey === hadith.globalBookKey);
            if (currentChapter) {
                chapterTitle = currentLang === 'ar' ? 
                    (currentChapter.arabic || currentChapter.title_ar || currentChapter.name_ar || currentChapter.name || '') : 
                    (currentChapter.english || currentChapter.title_en || currentChapter.name_en || currentChapter.text_en || '');
            }
        }
        if (!chapterTitle) chapterTitle = currentLang === 'ar' ? 'باب' : 'Chapter';

        let text = getHadithText(hadith, currentLang);
        let narrator = getHadithNarrator(hadith, currentLang);
        let bookNameLabel = currentLang === 'ar' ? (hadith.globalBookTitleAr || '') : (hadith.globalBookTitleEn || '');
        
        text = highlightText(text, query);
        chapterTitle = highlightText(chapterTitle, query);
        bookNameLabel = highlightText(bookNameLabel, query);
        if (narrator) narrator = highlightText(narrator, query);

        const alignClass = currentLang === 'ar' ? 'text-right font-serif' : 'text-left font-sans';
        const hadithNum = hadith.num || hadith.id || '';
        
        htmlString += `
            <div class="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-6 shadow-sm hover:shadow-md transition-all mb-4">
                <div class="flex justify-between items-center border-b border-gray-100 pb-4">
                    <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-full border border-gray-200 bg-madinah-gold text-white text-xs font-bold flex items-center justify-center">#${hadithNum}</span>
                        <span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">${bookNameLabel}</span>
                    </div>
                    <span class="text-xs font-bold text-madinah-green bg-green-50 px-3 py-1 rounded-full">${chapterTitle}</span>
                </div>
                <p class="text-xl leading-relaxed text-madinah-dark ${alignClass}">${text}</p>
                ${narrator ? `
                <div class="pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-1.5" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}">
                    <i class="fa-solid fa-user text-madinah-gold"></i> 
                    <span><strong>${currentLang === 'ar' ? 'الراوي:' : 'Narrator:'}</strong> ${narrator}</span>
                </div>` : ''}
            </div>`;
    });

    container.innerHTML = htmlString;
    renderGlobalPaginationControls(query); 
}

function renderGlobalPaginationControls(query) {
    removeGlobalPagination(); 

    const totalPages = Math.ceil(globalFilteredResults.length / globalItemsPerPage);
    if (totalPages <= 1) return; 

    const navContainer = document.createElement('div');
    navContainer.id = 'global-pagination-controls';
    navContainer.className = 'flex justify-center items-center space-x-2 space-x-reverse mt-6 py-4';

    const prevLabel = currentLang === 'ar' ? 'السابق' : 'Previous';
    const nextLabel = currentLang === 'ar' ? 'التالي' : 'Next';

    if (globalCurrentPage > 1) {
        navContainer.innerHTML += `<button onclick="changeGlobalPage(${globalCurrentPage - 1})" class="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-madinah-gold hover:text-white dark:hover:bg-madinah-gold transition-colors">${prevLabel}</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= globalCurrentPage - 1 && i <= globalCurrentPage + 1)) {
            const activeClass = i === globalCurrentPage ? 'bg-madinah-gold text-white font-bold' : 'bg-gray-50 text-gray-700 hover:bg-gray-100';
            navContainer.innerHTML += `<button onclick="changeGlobalPage(${i})" class="px-3 py-2 ${activeClass} rounded-lg text-sm transition-colors">${i}</button>`;
        } else if (i === globalCurrentPage - 2 || i === globalCurrentPage + 2) {
            navContainer.innerHTML += `<span class="text-gray-400">...</span>`;
        }
    }

    if (globalCurrentPage < totalPages) {
        navContainer.innerHTML += `<button onclick="changeGlobalPage(${globalCurrentPage + 1})" class="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-madinah-gold hover:text-white dark:hover:bg-madinah-gold transition-colors">${nextLabel}</button>`;
    }

    const container = document.getElementById('hadiths-container');
    if (container) container.after(navContainer);
}

function changeGlobalPage(pageNumber) {
    globalCurrentPage = pageNumber;
    const query = document.getElementById('global-search').value.trim();
    displayGlobalPage(pageNumber, query);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function removeGlobalPagination() {
    const existingControls = document.getElementById('global-pagination-controls');
    if (existingControls) existingControls.remove();
}

function filterAndSearch() {
    const searchInput = document.getElementById('hadith-search');
    if (!searchInput) return;
    currentTextFilter = cleanArabicText(searchInput.value);
    if (selectedChapterId !== null) {
        renderHadiths(selectedChapterId);
    }
}

function findBookChapter(hadith) {
    if (!currentBookData || !currentBookData.chapters) return null;
    const chapterId = hadith.chapter_id !== undefined ? hadith.chapter_id : (hadith.chapterId !== undefined ? hadith.chapterId : hadith.book_id);
    return currentBookData.chapters.find(c => c.id == chapterId);
}

function getLocalHadithNumber(hadith) {
    if (!currentBookData || !Array.isArray(currentBookData.hadiths)) return hadith.num || hadith.id || '';

    const chapterId = hadith.chapter_id !== undefined ? hadith.chapter_id : (hadith.chapterId !== undefined ? hadith.chapterId : hadith.book_id);

    const siblings = currentBookData.hadiths
        .filter(h => {
            const hChapterId = h.chapter_id !== undefined ? h.chapter_id : (h.chapterId !== undefined ? h.chapterId : h.book_id);
            return hChapterId == chapterId;
        })
        .sort((a, b) => (a.id || 0) - (b.id || 0));

    const idx = siblings.findIndex(h => h === hadith);
    return idx >= 0 ? idx + 1 : (hadith.num || hadith.id || '');
}

function performBookSearch() {
    const input = document.getElementById('book-search');
    const resultsContainer = document.getElementById('book-search-results');
    const chaptersGrid = document.getElementById('chapters-grid');
    if (!input || !resultsContainer || !chaptersGrid) return;

    const rawQuery = input.value.trim();

    if (rawQuery === '') {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
        chaptersGrid.classList.remove('hidden');
        return;
    }

    if (!currentBookData || !currentBookData.hadiths) return;

    let matches = [];

    if (currentLang === 'ar') {
        const query = cleanArabicText(rawQuery);
        matches = currentBookData.hadiths.filter(h => {
            const text = cleanArabicText(h.arabic || '');
            const chapter = findBookChapter(h);
            const chapterTitle = chapter ? cleanArabicText(chapter.arabic || chapter.title_ar || chapter.name_ar || chapter.name || '') : '';
            return text.includes(query) || chapterTitle.includes(query);
        });
    } else {
        const query = rawQuery.toLowerCase();
        matches = currentBookData.hadiths.filter(h => {
            const text = getHadithText(h, 'en').toLowerCase();
            const narrator = getHadithNarrator(h, 'en').toLowerCase();
            const chapter = findBookChapter(h);
            const chapterTitle = chapter ? (chapter.english || chapter.title_en || chapter.name_en || chapter.text_en || '').toLowerCase() : '';
            return text.includes(query) || narrator.includes(query) || chapterTitle.includes(query);
        });
    }

    chaptersGrid.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    renderBookSearchResults(matches, rawQuery);
}

function renderBookSearchResults(matches, query) {
    const resultsContainer = document.getElementById('book-search-results');
    if (!resultsContainer) return;

    if (matches.length === 0) {
        const noResultsMsg = currentLang === 'ar' ? 
        `
                <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 w-full">
                    <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-madinah-gold">
                        <i class="fa-solid fa-folder-open text-2xl"></i>
                    </div>
                    <h4 class="font-bold text-lg text-madinah-dark">لم نعثر على أي نتائج مطابقة</h4>
                </div>
            ` :
             `
                <div class="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 w-full">
                    <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-madinah-gold">
                        <i class="fa-solid fa-folder-open text-2xl"></i>
                    </div>
                    <h4 class="font-bold text-lg text-madinah-dark">No matching results found</h4>
                </div>
            `;
        resultsContainer.innerHTML = `<p class="text-center text-gray-500 py-8 font-medium">${noResultsMsg}</p>`;
        return;
    }

    const MAX_RESULTS = 50;
    const limitedMatches = matches.slice(0, MAX_RESULTS);

    let htmlString = limitedMatches.map(hadith => {
        const chapterId = hadith.chapter_id !== undefined ? hadith.chapter_id : (hadith.chapterId !== undefined ? hadith.chapterId : hadith.book_id);
        const chapter = findBookChapter(hadith);
        let chapterTitle = chapter ? (currentLang === 'ar' ?
            (chapter.arabic || chapter.title_ar || chapter.name_ar || chapter.name || '') :
            (chapter.english || chapter.title_en || chapter.name_en || chapter.text_en || '')) : '';
        if (!chapterTitle) chapterTitle = currentLang === 'ar' ? 'باب' : 'Chapter';

        let text = getHadithText(hadith, currentLang);
        let narrator = getHadithNarrator(hadith, currentLang);

        text = highlightText(text, query);
        chapterTitle = highlightText(chapterTitle, query);
        if (narrator) narrator = highlightText(narrator, query);

        const alignClass = currentLang === 'ar' ? 'text-right font-serif' : 'text-left font-sans';
        const hadithNum = getLocalHadithNumber(hadith);
 
        return `
            <div class="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 space-y-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
                 onclick="openBookChapterFromSearch('${chapterId}')">
                <div class="flex justify-between items-center border-b border-gray-100 pb-4">
                    <span class="w-8 h-8 rounded-full border border-gray-200 bg-madinah-gold text-white text-xs font-bold flex items-center justify-center">#${hadithNum}</span>
                    <span class="text-xs font-bold text-madinah-green bg-green-50 px-3 py-1 rounded-full">${chapterTitle}</span>
                </div>
                <p class="text-lg leading-relaxed text-madinah-dark ${alignClass}">${text}</p>
                ${narrator ? `
                <div class="pt-2 text-xs text-gray-500 flex items-center gap-1.5">
                    <i class="fa-solid fa-user text-madinah-gold"></i>
                    <span><strong>${currentLang === 'ar' ? 'الراوي:' : 'Narrator:'}</strong> ${narrator}</span>
                </div>` : ''}
            </div>
        `;
    }).join('');

    if (matches.length > MAX_RESULTS) {
        const moreMsg = currentLang === 'ar' ?
            `+ يوجد ${matches.length - MAX_RESULTS} نتيجة إضافية، حدّد كلمة بحث أدق لعرضها` :
            `+ ${matches.length - MAX_RESULTS} more results, refine your search to see them`;
        htmlString += `<p class="text-center text-xs text-gray-400 py-2">${moreMsg}</p>`;
    }

    resultsContainer.innerHTML = htmlString;
}

function openBookChapterFromSearch(chapterId) {
    if (!currentBookData) return;
    const chapter = currentBookData.chapters.find(c => c.id == chapterId);
    const chapterTitle = chapter ? (currentLang === 'ar' ?
        (chapter.arabic || chapter.title_ar || chapter.name_ar || chapter.name || '') :
        (chapter.english || chapter.title_en || chapter.name_en || chapter.text_en || '')) : '';

    selectedChapterId = chapter ? chapter.id : chapterId;

    const breadcrumbDivider = document.getElementById('breadcrumb-divider');
    const breadcrumbChapter = document.getElementById('breadcrumb-chapter');
    const hadithScreenChapter = document.getElementById('hadith-screen-chapter');

    if (breadcrumbDivider) breadcrumbDivider.classList.remove('hidden');
    if (breadcrumbChapter) breadcrumbChapter.innerText = chapterTitle;
    if (hadithScreenChapter) hadithScreenChapter.innerText = chapterTitle;

    currentTextFilter = '';
    currentLengthFilter = 'all';
    const chapterSearchInput = document.getElementById('hadith-search');
    if (chapterSearchInput) chapterSearchInput.value = '';
    resetFilterButtons();

    renderHadiths(selectedChapterId);
    showScreen('hadiths');

    const bookSearchInput = document.getElementById('book-search');
    const bookSearchResults = document.getElementById('book-search-results');
    const chaptersGrid = document.getElementById('chapters-grid');
    if (bookSearchInput) bookSearchInput.value = '';
    if (bookSearchResults) { bookSearchResults.classList.add('hidden'); bookSearchResults.innerHTML = ''; }
    if (chaptersGrid) chaptersGrid.classList.remove('hidden');
}