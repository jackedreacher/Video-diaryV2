import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'tr';

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Translations
export const translations = {
  en: {
    // Common
    success: 'Success',
    error: 'Error',
    cancel: 'Cancel',
    delete: 'Delete',
    clear: 'Clear',
    save: 'Save Changes',
    confirm: 'Confirm',
    warning: 'Warning',
    info: 'Info',
    loading: 'Loading...',

    // Settings Screen
    themeSettings: 'Settings',
    darkMode: 'Dark Mode',
    themeTemplate: 'Theme Template',
    categoryManagement: 'Category Management',
    coreMemoryTypes: 'Core Memory Types',
    comingSoon: 'Coming Soon',
    databaseManagement: 'Database Management',
    deleteAllDiaryContent: 'Delete All Diary Content',
    deleteSingleDiary: 'Delete Single Diary',
    clearAllData: 'Clear All Data',
    noCustomMemoryTypes: 'No custom memory types yet.',
    createInCoreMemory: 'Create them in the Core Memory screen!',
    cloudBackup: 'Cloud Backup',
    shareVideos: 'Share Videos',
    coreMemoryEditor: 'Core Memory Editor',
    language: 'Language',
    selectLanguage: 'Select Language',
    english: 'English',
    turkish: 'Turkish',

    // Home Screen (index.tsx)
    welcomeBack: 'Welcome Back',
    todaysMemories: "Diary",
    coreMemories: 'Core Memories',
    recentVideos: 'Recent Videos',
    addNewCategory: 'Add New Category',
    createCategory: 'Create Category',
    categoryName: 'Category Name',
    chooseIcon: 'Choose Icon',
    chooseColor: 'Choose Color',
    noCoreMemoriesYet: 'No core memories yet.\nTap "Add New" to create one!',
    myDiaryCollection: 'My Diary Collection',
    recentCollection: 'Recent Collection',

    // Create Core Memory Screen
    createCoreMemory: 'Create Core Memory',
    transformMoments: 'Transform your special moments into lasting memories',
    selectMoment: 'Select a Moment',
    createCustomType: 'Create Custom Type',
    noAvailableVideos: 'No available videos',
    recordNewMoments: 'Record new moments first!',
    memoryTypeName: 'Memory Type Name',

    // Add Screen
    createNewMemory: 'Add Memory',
    selectVideo: 'Select Video',
    selectVideoDescription: 'Select a video from your library to create a beautiful memory',
    maxDuration: 'Maximum duration: 60 seconds',
    tips: 'Tips:',
    tipWellLit: '• Choose a well-lit video',
    tipSteady: '• Keep the camera steady',
    tipClear: '• Capture the moment clearly',
    savingVideo: 'Saving video...',

    // Diary Screen
    search: 'Search memories...',
    sortBy: 'Sort by',
    date: 'Date',
    title: 'Library',
    duration: 'Duration',
    noVideosFound: 'No videos found',
    startRecording: 'Start recording your memories!',
    noVideosMatchSearch: 'No videos match your search',
    noVideosInCategory: 'No videos in this category',
    videosDeletedSuccessfully: 'Videos deleted successfully',
    failedToDeleteVideos: 'Failed to delete videos',

    // Video Details Screen
    videoDetails: 'Video Details',
    share: 'Share',
    deleteVideo: 'Delete Video',
    editDetails: 'Edit Details',

    // Crop Modal
    cropVideo: 'Crop Video',
    videoTitle: 'Video Title',
    videoDescription: 'Video Description (optional)',
    selectCategory: 'Select Category',
    startTrim: 'Start Trim',
    preview: 'Preview',
    saveVideo: 'Save Video',

    // Alerts
    deleteConfirmation: 'Are you sure you want to delete this?',
    cannotBeUndone: 'This action cannot be undone.',
    deleteSuccess: 'Successfully deleted!',
    savingChanges: 'Saving changes...',
    changesSaved: 'Changes saved successfully!',

    // Categories
    categoryAll: 'mal',
    categoryFriends: 'Friends',
    categoryFamily: 'Family',
    categoryTravel: 'Travel',
    categorySpecial: 'Special',
    
    // Category Descriptions (optional)
    categoryAllDesc: 'All memories',
    categoryFriendsDesc: 'Moments with friends',
    categoryFamilyDesc: 'Family memories',
    categoryTravelDesc: 'Travel adventures',
    categorySpecialDesc: 'Special moments',

    categories: {
      all: "All",
      friends: "Friends",
      family: "Family",
      travel: "Travel",
      special: "Special",
    },

    // Crop Modal - First Screen
    createSegment: "Create a segment",
    addDetails: "Add details",
    singlePlay: "Single Play",
    previewMode: "Preview Mode",
    next: "Next",
    processingVideo: "Processing video...",

    // Crop Modal - Second Screen
    titleRequired: "Title is required",
    titleMaxLength: "Title must be less than {0} characters",
    descriptionMaxLength: "Description must be less than {0} characters",
    pleaseSelectCategory: "Please select a category",
    enterVideoTitle: "Enter video title...",
    enterDescription: "Enter description (optional)...",
    characters: "characters",

    noMomentsAvailable: "No Moments Available",
    createNewMomentFirst: "Create a new moment to start building your core memories",
    createNew: "Create New",
    pullToRefresh: "Pull down to refresh and see your new memory!",
  },
  tr: {
    // Common
    success: 'Başarılı',
    error: 'Hata',
    cancel: 'İptal',
    delete: 'Sil',
    clear: 'Temizle',
    save: 'Değişiklikleri Kaydet',
    confirm: 'Onayla',
    warning: 'Uyarı',
    info: 'Bilgi',
    loading: 'Yükleniyor...',

    // Settings Screen
    themeSettings: 'Tema Ayarları',
    darkMode: 'Karanlık Mod',
    themeTemplate: 'Tema Şablonu',
    categoryManagement: 'Kategori Yönetimi',
    coreMemoryTypes: 'Temel Anı Türleri',
    comingSoon: 'Yakında',
    databaseManagement: 'Veritabanı Yönetimi',
    deleteAllDiaryContent: 'Tüm Günlük İçeriğini Sil',
    deleteSingleDiary: 'Tek Günlük Sil',
    clearAllData: 'Tüm Verileri Temizle',
    noCustomMemoryTypes: 'Henüz özel anı türü yok.',
    createInCoreMemory: 'Temel Anı ekranında oluşturun!',
    cloudBackup: 'Bulut Yedekleme',
    shareVideos: 'Videoları Paylaş',
    coreMemoryEditor: 'Temel Anı Düzenleyici',
    language: 'Dil',
    selectLanguage: 'Dil Seçin',
    english: 'İngilizce',
    turkish: 'Türkçe',

    // Home Screen (index.tsx)
    welcomeBack: 'Tekrar Hoşgeldiniz',
    todaysMemories: 'Günlüğüm',
    coreMemories: 'Çekirdek Anılar',
    recentVideos: 'Son Videolar',
    addNewCategory: 'Yeni Kategori Ekle',
    createCategory: 'Kategori Oluştur',
    categoryName: 'Kategori Adı',
    chooseIcon: 'İkon Seç',
    chooseColor: 'Renk Seç',
    noCoreMemoriesYet: 'Henüz temel anı yok.\n"Yeni Ekle" ye dokunarak oluşturun!',
    myDiaryCollection: 'Günlük Koleksiyonum',
    recentCollection: 'Son Eklenenler',

    // Create Core Memory Screen
    createCoreMemory: 'Temel Anı Oluştur',
    transformMoments: 'Özel anlarınızı kalıcı anılara dönüştürün',
    selectMoment: 'Bir An Seçin',
    createCustomType: 'Özel Tür Oluştur',
    noAvailableVideos: 'Kullanılabilir video yok',
    recordNewMoments: 'Önce yeni anlar kaydedin!',
    memoryTypeName: 'Anı Türü Adı',

    // Add Screen
    createNewMemory: 'Yeni Anı Oluştur',
    selectVideo: 'Video Seç',
    selectVideoDescription: 'Güzel bir anı oluşturmak için kütüphanenizden bir video seçin',
    maxDuration: 'Maksimum süre: 60 saniye',
    tips: 'İpuçları:',
    tipWellLit: '• İyi aydınlatılmış video seçin',
    tipSteady: '• Kamerayı sabit tutun',
    tipClear: '• Anı net bir şekilde kaydedin',
    savingVideo: 'Video kaydediliyor...',

    // Diary Screen
    search: 'Anılarda ara...',
    sortBy: 'Sıralama',
    date: 'Tarih',
    title: 'Kütüphane',
    duration: 'Süre',
    noVideosFound: 'Video bulunamadı',
    startRecording: 'Anılarınızı kaydetmeye başlayın!',
    noVideosMatchSearch: 'Aramanızla eşleşen video yok',
    noVideosInCategory: 'Bu kategoride video yok',
    videosDeletedSuccessfully: 'Videolar başarıyla silindi',
    failedToDeleteVideos: 'Videolar silinemedi',

    // Video Details Screen
    videoDetails: 'Video Detayları',
    share: 'Paylaş',
    deleteVideo: 'Videoyu Sil',
    editDetails: 'Detayları Düzenle',

    // Crop Modal
    cropVideo: 'Videoyu Kırp',
    videoTitle: 'Video Başlığı',
    videoDescription: 'Video Açıklaması (isteğe bağlı)',
    selectCategory: 'Kategori Seç',
    startTrim: 'Kırpmaya Başla',
    preview: 'Önizleme',
    saveVideo: 'Videoyu Kaydet',

    // Alerts
    deleteConfirmation: 'Bunu silmek istediğinizden emin misiniz?',
    cannotBeUndone: 'Bu işlem geri alınamaz.',
    deleteSuccess: 'Başarıyla silindi!',
    savingChanges: 'Değişiklikler kaydediliyor...',
    changesSaved: 'Değişiklikler başarıyla kaydedildi!',

    // Categories
    categoryAll: 'Tümü',
    categoryFriends: 'Arkadaşlar',
    categoryFamily: 'Aile',
    categoryTravel: 'Seyahat',
    categorySpecial: 'Özel',
    
    // Category Descriptions (optional)
    categoryAllDesc: 'Tüm anılar',
    categoryFriendsDesc: 'Arkadaşlarla anlar',
    categoryFamilyDesc: 'Aile anıları',
    categoryTravelDesc: 'Seyahat maceraları',
    categorySpecialDesc: 'Özel anlar',

    categories: {
      all: "Tümü",
      friends: "Arkadaşlar",
      family: "Aile",
      travel: "Seyahat",
      special: "Özel",
    },

    // Crop Modal - First Screen
    createSegment: "Segment oluştur",
    addDetails: "Detayları ekle",
    singlePlay: "Tek Oynatma",
    previewMode: "Önizleme Modu",
    next: "İleri",
    processingVideo: "Video işleniyor...",

    // Crop Modal - Second Screen
    titleRequired: "Başlık gerekli",
    titleMaxLength: "Başlık {0} karakterden az olmalıdır",
    descriptionMaxLength: "Açıklama {0} karakterden az olmalıdır",
    pleaseSelectCategory: "Lütfen bir kategori seçin",
    enterVideoTitle: "Video başlığını girin...",
    enterDescription: "Açıklama girin (isteğe bağlı)...",
    characters: "karakter",

    noMomentsAvailable: "Mevcut Anı Yok",
    createNewMomentFirst: "Temel anılarınızı oluşturmaya başlamak için yeni bir an oluşturun",
    createNew: "Yeni Oluştur",
    pullToRefresh: "Yeni anınızı görmek için aşağı çekin!",
  }
} as const; 