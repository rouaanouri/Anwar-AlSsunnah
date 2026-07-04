let originalSearchResultsSnapshot = [];
let globalLengthFilter = 'all';

function setGlobalLengthFilter(type) {
    try {
        globalLengthFilter = type;

        const radioBtn = document.getElementById(`global-len-${type}`);
        if (radioBtn) {
            radioBtn.checked = true;
        }

        applyMyCustomFilters();
    } catch (e) {
        console.error("خطأ في setGlobalLengthFilter:", e);
    }
}

function resetGlobalFilters() {
    if (document.getElementById('global-search')) {
        document.getElementById('global-search').value = '';
    }
    if (document.getElementById('filter-global-chapter')) {
        document.getElementById('filter-global-chapter').value = '';
    }

    const selectBooks = document.getElementById('filter-global-books');
    if (selectBooks) {
        for (let i = 0; i < selectBooks.options.length; i++) {
            selectBooks.options[i].selected = true;
        }
    }

    setGlobalLengthFilter('all');
    originalSearchResultsSnapshot = [];

    console.log("تمت إعادة ضبط فلاتر البحث العام بنجاح!");
}

function toggleGlobalFilterModal(event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById('global-filter-modal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
}

document.addEventListener('click', function (event) {
    const modal = document.getElementById('global-filter-modal');
    if (modal && !modal.classList.contains('hidden')) {
        if (!modal.contains(event.target)) {
            modal.classList.add('hidden');
        }
    }
});

function applyAndCloseFilters() {
    applyMyCustomFilters();
    const modal = document.getElementById('global-filter-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function applyMyCustomFilters() {
    const isArabic = (typeof currentLang !== 'undefined' && currentLang === 'ar');
    if (originalSearchResultsSnapshot.length === 0 && typeof globalFilteredResults !== 'undefined' && globalFilteredResults.length > 0) {
        originalSearchResultsSnapshot = [...globalFilteredResults];
    }

    const dataSource = originalSearchResultsSnapshot.length > 0 ? originalSearchResultsSnapshot : (typeof globalFilteredResults !== 'undefined' ? globalFilteredResults : []);

    if (dataSource.length === 0) {
        return;
    }

    const chapterInput = document.getElementById('filter-global-chapter');
    const selectBooks = document.getElementById('filter-global-books');

    const chapterKeyword = chapterInput?.value?.trim() || "";
    let selectedBooks = [];
    if (selectBooks) {
        selectedBooks = Array.from(selectBooks.selectedOptions).map(option => option.value);
    }

    const lengthType = typeof globalLengthFilter !== 'undefined' ? globalLengthFilter : 'all';

    const cleanedChapterKeyword = typeof cleanArabicText === 'function' ? cleanArabicText(chapterKeyword) : chapterKeyword;

    globalFilteredResults = dataSource.filter(hadith => {

        if (selectedBooks.length > 0 && !selectedBooks.includes(hadith.globalBookKey || hadith.bookKey)) {
            return false;
        }


        if (chapterKeyword) {
            let chapterTitle = '';
            if (window.globalAllChapters) {
                const currentChapter = window.globalAllChapters.find(c => c.id == getChapterId(hadith));
                if (currentChapter) {
                    const rawTitle = getChapterTitle(currentChapter, isArabic ? 'ar' : 'en');
                    chapterTitle = isArabic && typeof cleanArabicText === 'function' ? cleanArabicText(rawTitle) : rawTitle;
                }
            }
            const keyword = isArabic ? (typeof cleanArabicText === 'function' ? cleanArabicText(chapterKeyword) : chapterKeyword) : chapterKeyword.toLowerCase();
            const targetTitle = isArabic ? chapterTitle : chapterTitle.toLowerCase();

            if (!targetTitle.includes(keyword)) return false;
        }

        if (hadith.arabic && !matchesLengthFilter(hadith.arabic, lengthType)) {
            return false;
        }

        return true;
    });
   const globalSearchInput = document.getElementById('global-search');
const isSearchEmpty = !globalSearchInput || globalSearchInput.value.trim() === "";

const countLabel = document.getElementById('results-count-label');
if (countLabel) {
    if (!globalSearchInput || globalSearchInput.value.trim() === "") {
        countLabel.innerText = "";
    } else {
        countLabel.innerText = isArabic 
            ? `عدد النتائج: ${globalFilteredResults.length}` 
            : `Results: ${globalFilteredResults.length}`;
    }
}
    if (typeof globalCurrentPage !== 'undefined' && typeof displayGlobalPage === 'function') {
        globalCurrentPage = 1;
        const inputField = document.getElementById('global-search');
        displayGlobalPage(globalCurrentPage, inputField?.value || "");
    }
}


document.addEventListener("DOMContentLoaded", () => {
    try {
        document.getElementById("filter-global-chapter")?.addEventListener("input", debounce(applyMyCustomFilters, 250));
        document.getElementById("filter-global-books")?.addEventListener("change", applyMyCustomFilters);

        ['all', 'short', 'long'].forEach(type => {
            document.getElementById(`global-len-${type}`)?.addEventListener("change", () => {
                setGlobalLengthFilter(type);
            });
        });
      document.getElementById("global-search")?.addEventListener("input", debounce((e) => {
    const searchVal = e.target.value.trim();
    const countLabel = document.getElementById('results-count-label');

    if (searchVal === "") {
        if (countLabel) countLabel.innerText = ""; 
        
        originalSearchResultsSnapshot = [];
        globalFilteredResults = [];
        
       
    } else {
        applyMyCustomFilters();
    }
}, 250));
    } catch (error) {
        console.error("خطأ أثناء تهيئة مستمعي الأحداث في ملف الفلترة:", error);
    }
});
