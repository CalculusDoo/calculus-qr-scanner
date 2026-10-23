import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BarcodeScanningResult,
  Camera,
  CameraType,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { AntDesign, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import images from '@/assets/constants/images';
import {
  customAlert,
  getReceiptDataFromTC,
} from '@/lib/helpers';
import { useGlobalContext } from '@/lib/global-provider';
import { ReceiptDataFromTC } from '@/lib/types/Receipt';
import ReceiptModal from '@/components/modals/ReceiptModal';
import ReceiptsListDrawer from '@/components/modals/ReceiptsListDrawer';
import DatabaseSelector from '@/components/DatabaseSelector';
import OcrCameraHint from '@/components/receipt-ocr/OcrCameraHint';
import { appendVerifiedReceipt } from '@/lib/receipt-import';
import ReceiptVerificationModal from '@/components/receipt-ocr/ReceiptVerificationModal';
import { amountInMinorUnits, isOfficialReceiptUrl, ReceiptVerificationDraft } from '@/lib/receipt-verification';
import { useAnnouncements } from '@/lib/useAnnouncements';
import { nextPopupAnnouncement } from '@/lib/announcements';
import { Announcement } from '@/lib/types/Announcement';
import AnnouncementsDrawer from '@/components/announcements/AnnouncementsDrawer';
import AnnouncementPopup from '@/components/announcements/AnnouncementPopup';

export default function Index() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [receiptsVisible, setReceiptsVisible] = useState<boolean>(false);

  const [scanned, setScanned] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [ocrHintVisible, setOcrHintVisible] = useState(false);
  const [cameraSize, setCameraSize] = useState({ width: 0, height: 0 });
  const hintDismissed = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissOcrHint = useCallback(() => {
    hintDismissed.current = true;
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setOcrHintVisible(false);
  }, []);
  const processingRef = useRef(false);
  const receiptRequest = useRef<AbortController | null>(null);

  const [scannedData, setScannedData] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [scannedInvoiceNumber, setScannedInvoiceNumber] = useState<string>('');
  const [scannedReceiptDataFromTC, setScannedReceiptDataFromTC] =
    useState<ReceiptDataFromTC>({
      invoiceNumber: '',
      shopName: '',
      totalAmount: '',
      sdcDateTime: '',
      monospaceContent: '',
    });

  const [cameraPermission, requestPermission] = useCameraPermissions();
  const { user, scannedReceipts, setScannedReceipts, cameraOpen, setCameraOpen } =
    useGlobalContext();

  const session = useRef({ user, scannedReceipts });
  useLayoutEffect(() => { session.current = { user, scannedReceipts }; }, [user, scannedReceipts]);

  const insets = useSafeAreaInsets();
  const {
    announcements,
    unreadCount,
    refreshing: announcementsRefreshing,
    refresh: refreshAnnouncements,
    setRead: setAnnouncementRead,
  } = useAnnouncements();
  const [announcementsVisible, setAnnouncementsVisible] = useState(false);
  const [popupAnnouncement, setPopupAnnouncement] = useState<Announcement | null>(null);
  // Važno obaveštenje se u jednoj sesiji prikazuje najviše jednom, i ako označavanje ne uspe
  const shownPopupIds = useRef(new Set<string>());

  useFocusEffect(
    useCallback(() => {
      void refreshAnnouncements();
    }, [refreshAnnouncements]),
  );

  useEffect(() => {
    if (cameraOpen || announcementsVisible || popupAnnouncement) return;
    const next = nextPopupAnnouncement(announcements, shownPopupIds.current);
    if (next) setPopupAnnouncement(next);
  }, [announcements, cameraOpen, announcementsVisible, popupAnnouncement]);

  const closePopupAnnouncement = (announcement: Announcement) => {
    shownPopupIds.current.add(announcement.id);
    setPopupAnnouncement(null);
    void setAnnouncementRead(announcement.id);
  };

  useEffect(() => {
    if (cameraOpen && !hintDismissed.current) {
      hintTimer.current = setTimeout(() => {
        if (!hintDismissed.current) setOcrHintVisible(true);
      }, 10000);
    }
    return () => { if (hintTimer.current) clearTimeout(hintTimer.current); };
  }, [cameraOpen]);

  const processScannedUrl = async (url: string, expected?: ReceiptVerificationDraft): Promise<boolean> => {
    dismissOcrHint();
    if (scanned || processingRef.current) return false;

    if (!isOfficialReceiptUrl(url)) {
      customAlert(
        'Upozorenje!',
        'Molimo Vas skenirajte QR kod sa fiskalnog računa.',
      );
      return false;
    }

    processingRef.current = true;
    setScanned(true);
    setIsProcessing(true);
    setScannedData(url);
    return await handleReadBarcode(url, expected);
  };

  function openManualEntry() {
    dismissOcrHint();
    if (!user?.selectedDB || !user.databases?.some((database) => database.serialNum === user.selectedDB)) {
      customAlert('Upozorenje!', 'Molimo izaberite bazu za skeniranje pre učitavanja računa.');
      return;
    }
    if (!processingRef.current && !scanned) {
      // Release the live scanner before opening the photo capture camera.
      setCameraOpen(false);
      setManualEntryVisible(true);
    }
  }

  async function openCamera() {
    const hasSelectedDB =
      !!user?.selectedDB &&
      Array.isArray(user?.databases) &&
      user.databases.some((d) => d.serialNum === user.selectedDB);

    if (!hasSelectedDB) {
      return customAlert(
        'Upozorenje!',
        'Molimo izaberite bazu za skeniranje pre otvaranja kamere. Odabir baze vrši se u drugom tabu sa ikonicom zupčanika.',
      );
    }

    if (!cameraPermission || cameraPermission.status !== 'granted') {
      const { status } = await requestPermission();
      if (status !== 'granted') {
        return customAlert(
          'Upozorenje!',
          'Aplikacija nema dozvolu za korišćenje kamere. Molimo Vas da omogućite pristup kameri u podešavanjima.',
        );
      }
    }
    hintDismissed.current = false;
    setOcrHintVisible(false);
    setCameraOpen(true);
  }

  function toggleCameraFacing() {
    dismissOcrHint();
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }

  const pickImageAndScan = async () => {
    dismissOcrHint();
    try {
      if (scanned || isProcessing) return;

      if (Platform.OS === 'ios') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          return customAlert(
            'Upozorenje!',
            'Aplikacija nema dozvolu za pristup galeriji. Molimo Vas da omogućite pristup u podešavanjima.',
          );
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        selectionLimit: 1,
        quality: 1,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri)
        return customAlert('Greška!', 'Nije moguće učitati izabranu sliku.');

      const scannedCodes = await Camera.scanFromURLAsync(uri, ['qr']);
      if (!scannedCodes?.length) {
        return customAlert(
          'Upozorenje!',
          'Na izabranoj slici nije pronađen QR kod.',
        );
      }

      const data = scannedCodes[0]?.data;
      if (!data) {
        return customAlert(
          'Upozorenje!',
          'Na izabranoj slici nije pronađen QR kod.',
        );
      }

      await processScannedUrl(data);
    } catch {
      resetScanFlags();
      customAlert(
        'Greška!',
        'Došlo je do greške prilikom skeniranja QR koda iz slike.',
      );
    }
  };
  const resetScanFlags = () => {
    receiptRequest.current?.abort();
    receiptRequest.current = null;
    processingRef.current = false;
    setScanned(false);
    setIsProcessing(false);
  };

  const handleReadBarcode = async (url: string, expected?: ReceiptVerificationDraft): Promise<boolean> => {
    const request = new AbortController();
    receiptRequest.current = request;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; request.abort(); }, 20000);
    try {
      const response = await fetch(url, { signal: request.signal });
      if (!response.ok || (response.url && !isOfficialReceiptUrl(response.url))) throw new Error('Invalid receipt response');
      const htmlText = await response.text();
      if (request.signal.aborted) throw new Error('Receipt request aborted');

      const receiptData = getReceiptDataFromTC(htmlText);
      if (!receiptData) {
        customAlert(
          'Upozorenje!',
          'Došlo je do promene strukture na sajtu poreske uprave. Obratite se korisničkoj podršci',
        );
        resetScanFlags();
        return false;
      }

      if (expected && ((expected.invoiceNumber.trim() && receiptData.invoiceNumber?.toUpperCase() !== expected.invoiceNumber.trim().toUpperCase()) ||
          (amountInMinorUnits(expected.totalAmount) !== null && amountInMinorUnits(receiptData.totalAmount ?? '') !== amountInMinorUnits(expected.totalAmount)))) {
        customAlert('Upozorenje!', 'Podaci proverenog računa se ne poklapaju sa unetim PFR brojem ili iznosom. Proverite podatke na stranici Poreske uprave.');
        resetScanFlags();
        return false;
      }

      if (expected) {
        const result = appendVerifiedReceipt(session.current.scannedReceipts, session.current.user, url, receiptData);
        if ('error' in result) {
          customAlert('Upozorenje!', result.error);
          resetScanFlags();
          return false;
        }
        if (!result.duplicate) {
          session.current = { ...session.current, scannedReceipts: result.receipts };
          setScannedReceipts(result.receipts);
        }
        resetScanFlags();
        setScannedData('');
        customAlert('Obaveštenje', result.duplicate ? 'Ovaj račun je već učitan!' : 'Uspešno učitan račun.');
        return true;
      }

      setScannedReceiptDataFromTC(receiptData);
      setScannedInvoiceNumber(receiptData.invoiceNumber);
      setShowModal(true);
      return true;
    } catch {
      if (request.signal.aborted && !timedOut) return false;
      resetScanFlags();
      customAlert(
        'Greška!',
        'Greška prilikom parsiranja URL adrese poreske uprave!',
      );
      return false;
    } finally {
      clearTimeout(timeout);
      if (receiptRequest.current === request) receiptRequest.current = null;
    }
  };

  const handleBarcodeScanned = async (qrCodeResults: BarcodeScanningResult) => {
    await processScannedUrl(qrCodeResults.data);
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        dismissOcrHint();
        setCameraOpen(false);
        resetScanFlags();
        setManualEntryVisible(false);
        setShowModal(false);
      };
    }, [setCameraOpen, dismissOcrHint]),
  );

  const manualEntry = manualEntryVisible && (
    <ReceiptVerificationModal
      onClose={() => { setManualEntryVisible(false); setCameraOpen(true); }}
      onImport={processScannedUrl}
    />
  );

  const receiptPreview = showModal && !manualEntryVisible && (
    <ReceiptModal
      showModal={showModal}
      setShowModal={(val) => {
        setShowModal(val);
        if (!val) { resetScanFlags(); setScannedData(''); setScannedInvoiceNumber(''); }
      }}
      scannedData={scannedData}
      setScannedData={setScannedData}
      setScanned={setScanned}
      setProperScanned={() => {}}
      scannedInvoiceNumber={scannedInvoiceNumber}
      setScannedInvoiceNumber={setScannedInvoiceNumber}
      scannedReceiptDataFromTC={scannedReceiptDataFromTC}
      setScannedReceiptDataFromTC={setScannedReceiptDataFromTC}
    />
  );

  if (cameraOpen) {
    return (
      <View style={styles.container} onTouchStart={dismissOcrHint}
        onLayout={(event) => setCameraSize(event.nativeEvent.layout)}>
        <CameraView
          style={styles.fullscreenCamera}
          facing={facing}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned || manualEntryVisible ? undefined : handleBarcodeScanned}
        />

        <AntDesign
          style={styles.closeButton}
          name='close-circle'
          size={28}
          color='white'
          onPress={() => { dismissOcrHint(); resetScanFlags(); setCameraOpen(false); }}
        />
        <MaterialIcons
          style={styles.flipButton}
          name='flip-camera-android'
          size={28}
          color='white'
          onPress={toggleCameraFacing}
        />
        <Pressable
          onPress={pickImageAndScan}
          android_ripple={{ color: 'transparent' }}
          style={styles.galleryButton}
        >
          <Ionicons name='image-outline' size={24} color='black' />
        </Pressable>

        <Pressable accessibilityRole='button' accessibilityLabel='OCR skener računa'
          onPress={openManualEntry} style={styles.ocrButton}>
          <MaterialIcons name='document-scanner' size={24} color='#2368fd' />
        </Pressable>

        {scannedReceipts && scannedReceipts.length > 0 && (
          <>
            <Pressable
              onPress={() => { dismissOcrHint(); setReceiptsVisible(true); }}
              android_ripple={{ color: 'transparent' }}
              style={styles.showReceiptsButton}
            >
              <Ionicons name='receipt-outline' size={24} color='black' />
            </Pressable>
            <ReceiptsListDrawer
              visible={receiptsVisible}
              onClose={() => setReceiptsVisible(false)}
            />
          </>
        )}

        <View style={styles.scanGuide} pointerEvents='none'>
          <Ionicons name='scan-outline' size={250} color='white' />
          <Text style={styles.scanText}>Skenirajte QR kod</Text>
        </View>

        {ocrHintVisible && <OcrCameraHint width={cameraSize.width} height={cameraSize.height}
          buttonBottom={Platform.OS === 'ios' ? 160 : 180} />}
        {manualEntry}
        {receiptPreview}
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#2368fd',
        paddingHorizontal: 20,
      }}
    >
      <Pressable
        onPress={() => setAnnouncementsVisible(true)}
        hitSlop={10}
        accessibilityRole='button'
        accessibilityLabel={
          unreadCount > 0
            ? `Obaveštenja, nepročitanih: ${unreadCount}`
            : 'Obaveštenja'
        }
        style={[styles.bellButton, { top: insets.top + 12 }]}
      >
        <Ionicons name='notifications-outline' size={28} color='white' />
        {unreadCount > 0 && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>

      <Image
        source={images.logo}
        style={{
          width: '100%',
        }}
        resizeMode='contain'
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 40,
        }}
      >
        <Text
          className='font-rubik'
          style={{
            fontSize: 18,
            color: 'white',
            textAlign: 'center',
            marginRight: 8,
          }}
        >
          Baza za skeniranje:
        </Text>
        <DatabaseSelector variant='compact' />
      </View>

      <TouchableOpacity onPress={openCamera} style={{ alignItems: 'center' }}>
        <Image
          source={images.scan}
          className='rounded-full'
          style={{
            width: 250,
            height: 250,
          }}
          resizeMode='contain'
        />
      </TouchableOpacity>
      <Text
        className='font-rubik'
        style={{
          marginTop: 20,
          fontSize: 18,
          fontWeight: '600',
          color: 'white',
          textAlign: 'center',
        }}
      >
        Kliknite ikonicu iznad kako biste otvorili kameru i započeli skeniranje
        računa
      </Text>
      {manualEntry}
      {receiptPreview}
      <AnnouncementsDrawer
        visible={announcementsVisible}
        onClose={() => setAnnouncementsVisible(false)}
        announcements={announcements}
        refreshing={announcementsRefreshing}
        onRefresh={() => { void refreshAnnouncements(); }}
        onRead={(id) => { void setAnnouncementRead(id); }}
      />
      {!showModal && !manualEntryVisible && (
        <AnnouncementPopup
          announcement={popupAnnouncement}
          onClose={closePopupAnnouncement}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  fullscreenCamera: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    borderRadius: 20,
    padding: 10,
    color: 'white',
    zIndex: 1,
  },
  flipButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 120,
    right: 20,
    borderRadius: 20,
    padding: 10,
    color: 'white',
    zIndex: 1,
  },
  galleryButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 120,
    left: 20,
    borderRadius: 20,
    padding: 10,
    color: '#2368fd',
    backgroundColor: 'white',
    zIndex: 1,
  },
  ocrButton: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 160 : 180, left: 20,
    borderRadius: 20, padding: 10, backgroundColor: 'white', zIndex: 1,
  },
  showReceiptsButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 220 : 240,
    left: 20,
    borderRadius: 20,
    padding: 10,
    color: '#2368fd',
    backgroundColor: 'white',
    zIndex: 1,
  },

  bellButton: {
    position: 'absolute',
    right: 20,
    padding: 6,
    zIndex: 1,
  },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#f75555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: 'white',
    fontSize: 11,
    fontFamily: 'Rubik-Bold',
  },

  scanGuide: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'Rubik-Bold',
    position: 'absolute',
  },
});
