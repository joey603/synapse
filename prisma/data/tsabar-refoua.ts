export const TSABAR_NURSE = "Ariel Barthel";

export type TsabarPatient = {
  ref: string;
  firstName: string;
  lastName: string;
  city: string;
  address: string;
  phones: string[];
  access: string | null;
  frequency: string;
  operations: string | null;
};

export const TSABAR_PATIENTS: TsabarPatient[] = [
  { ref: "01", firstName: "Moche", lastName: "", city: "לוד", address: "רחוב פורצי מסך הברזל 6 לוד", phones: ["0537081586", "0505986171"], access: null, frequency: "2 visites frontales/semaine", operations: null },
  { ref: "02", firstName: "Rivka", lastName: "", city: "לוד", address: "יער אודם 5, לוד", phones: ["0528449100"], access: "code 1948, קומה 4, דירה 16", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "03", firstName: "Keren", lastName: "", city: "לוד", address: "רחוב האיילון 13 לוד", phones: ["0506383669"], access: "קומה 5", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "04", firstName: "Alicia", lastName: "", city: "לוד", address: "רחוב תלמים 5 לוד", phones: ["0525970908", "0539225741"], access: "קומה 8, דירה 32, קוד 0953", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "05", firstName: "Yael", lastName: "", city: "לוד", address: "רחוב זויתן 1 לוד", phones: ["0547250607"], access: "קומה 1, דלת 8", frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
  { ref: "06", firstName: "Acher", lastName: "", city: "רמלה", address: "רחוב משה לוי 5 רמלה", phones: ["0525930957"], access: "קומה 12, דירה 46, code #0456#", frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
  { ref: "07", firstName: "Dimitri", lastName: "", city: "רמלה", address: "רחוב הרב מימון 4 רמלה", phones: ["0546419873"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: "Fin HAD indiquée: 04/10" },
  { ref: "08", firstName: "Sarah", lastName: "", city: "רמלה", address: "רחוב השומר 1, רמלה", phones: ["0538625706"], access: null, frequency: "1 frontale/semaine", operations: null },
  { ref: "09", firstName: "Hana", lastName: "", city: "רמלה", address: "רחוב ויצמן 22 רמלה", phones: ["0542344312", "0548670946"], access: null, frequency: "1 frontale/semaine", operations: null },
  { ref: "10", firstName: "Ayelet", lastName: "", city: "רמלה", address: "רחוב דמארי שושנה 6 רמלה", phones: ["0533312270"], access: "קומה 2, דירה 10, code 1949", frequency: "1 frontale/semaine", operations: null },
  { ref: "11", firstName: "Leili", lastName: "", city: "רמלה", address: "רחוב דיין משה 6 רמלה", phones: ["0537346156"], access: "דירה 78, étage 19, code 2356", frequency: "1 frontale/semaine", operations: null },
  { ref: "12", firstName: "Aviran", lastName: "", city: "מצליח", address: "רחוב הרימון 337 מצליח", phones: ["0533338693"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "13", firstName: "Yelena", lastName: "", city: "באר יעקב", address: "רחוב הדובדבן 233 באר יעקב", phones: ["0527444611", "052250090"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: "Fin HAD indiquée: 19/09" },
  { ref: "14", firstName: "Berta", lastName: "", city: "באר יעקב", address: "רחוב שאנס 3 באר יעקב", phones: ["0528286843", "0522753477"], access: "קומה 13, דירה 49, code 4857*", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "15", firstName: "Rephael", lastName: "", city: "נס ציונה", address: "רחוב חרמון 14 נס ציונה", phones: ["0527040132"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "16", firstName: "Dor", lastName: "", city: "נס ציונה", address: "רחוב חרמון 14 נס ציונה", phones: ["0543935222"], access: null, frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
  { ref: "17", firstName: "Meital", lastName: "", city: "ראשון לציון", address: "מוהליבר 32 ראשון לציון", phones: ["0556667825"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "18", firstName: "Jacky", lastName: "", city: "ראשון לציון", address: "רחוב מבצע יואב 4 ראשון לציון", phones: ["0528008087"], access: "קומה 3, דירה 12, code 007", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "19", firstName: "Tadela", lastName: "", city: "ראשון לציון", address: "רחוב דוידזון 3 ראשון לציון", phones: ["0503467788"], access: "קומה 2, דירה 5", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "20", firstName: "Marina", lastName: "", city: "ראשון לציון", address: "רחוב הלוחמות 20 ראשון לציון", phones: ["0586497458"], access: "דירה 5, קומה 1, code 2020#", frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
  { ref: "21", firstName: "Michael", lastName: "", city: "ראשון לציון", address: "מבצע הראל 20, ראשון לציון", phones: ["0508844706"], access: null, frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
  { ref: "22", firstName: "Sahar", lastName: "", city: "ראשון לציון", address: "רחוב ששת הימים 3 ראשון לציון", phones: ["0525831824"], access: null, frequency: "2 frontales + 1 virtuelle/semaine", operations: "voisin d’Omri" },
  { ref: "23", firstName: "Omri", lastName: "", city: "ראשון לציון", address: "רחוב הפזית 37 ראשון לציון", phones: ["0502212312"], access: null, frequency: "2 frontales/semaine", operations: null },
  { ref: "24", firstName: "Yarin", lastName: "", city: "ראשון לציון", address: "רחוב רפידים 33 ראשון לציון", phones: ["0522464814"], access: null, frequency: "2 frontales/semaine", operations: null },
  { ref: "25", firstName: "Dana", lastName: "Saffran", city: "ראשון לציון", address: "רחוב חיל הצנחנים 11, ראשון לציון", phones: ["0542192428", "0549363520"], access: "קומה 2, דירה 8", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "26", firstName: "Dana", lastName: "", city: "ראשון לציון", address: "רחוב שרירא שמואל 17 ראשון לציון", phones: ["0537201465"], access: "code 1717", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "27", firstName: "Bar", lastName: "", city: "ראשון לציון", address: "רחוב יחזקאל הנביא 7 ראשון לציון", phones: ["0509563801", "0525600173"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "28", firstName: "Anat", lastName: "", city: "ראשון לציון", address: "רחוב סדרות יעקב 48 ראשון לציון", phones: ["0523569906"], access: null, frequency: "2 frontales + 2 virtuelles/semaine", operations: null },
  { ref: "29", firstName: "Justine", lastName: "", city: "ראשון לציון", address: "רחוב דגניה 12 ראשון לציון", phones: ["0504935611"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "30", firstName: "Fredy", lastName: "", city: "ראשון לציון", address: "רחוב שרירא שמואל 19 ראשון לציון", phones: ["0545507208", "0526607800"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "31", firstName: "Sharon", lastName: "", city: "ראשון לציון", address: "לבונטין 12 ראשון לציון", phones: ["0532215630"], access: "קומה 3, דירה 11, code 2580", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "32", firstName: "Neiman", lastName: "", city: "גני הדר", address: "רחוב האתרוג 48 גני הדר", phones: ["0523339830"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "33", firstName: "Acher", lastName: "", city: "יבנה", address: "רחוב המשוט 9 יבנה", phones: ["0537358008"], access: null, frequency: "2 frontales/semaine", operations: null },
  { ref: "34", firstName: "Shahar", lastName: "", city: "ביצרון", address: "רחוב העולים 86, ביצרון", phones: [], access: null, frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
  { ref: "35", firstName: "Sarah", lastName: "", city: "אשדוד", address: "רחוב הרב רוזובסקי 14 אשדוד", phones: ["0533170519", "0527654216"], access: "קומה 2, דירה 13", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "36", firstName: "Yael", lastName: "", city: "אשדוד", address: "רחוב הציונות 123 אשדוד", phones: ["0536210084"], access: "קומה 4, דירה 16", frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
  { ref: "37", firstName: "Natalia", lastName: "", city: "אשדוד", address: "רחוב המעפילים 6 אשדוד", phones: ["0526105300"], access: null, frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "38", firstName: "Sharon", lastName: "Lévy", city: "אשדוד", address: "רחוב מרטין בובר 1 אשדוד", phones: ["0502251923"], access: "קומה 8, דירה 805", frequency: "1 frontale + 1 virtuelle/semaine", operations: null },
  { ref: "39", firstName: "Reuben", lastName: "", city: "אשדוד", address: "רחוב אבן גבירול 19 אשדוד", phones: ["0528940601"], access: null, frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
  { ref: "40", firstName: "Ruth", lastName: "", city: "אשדוד", address: "רחוב רב חיסדא 21 אשדוד", phones: ["0527146543"], access: "קומה 3, דירה 12", frequency: "2 frontales + 1 virtuelle/semaine", operations: null },
];
