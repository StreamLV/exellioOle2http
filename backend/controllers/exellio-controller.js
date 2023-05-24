const configService = require('../config/config-service');
const configFr = configService.getConfigFr();
const winax = require('winax');

const frAdminPassword = '0000';

let errorMessage = '';
let errorSource = '';
let errorMessageConnect = '';
let fpOleObject;
let serialNumber = '';

const checkSetOleDbObject = () => {
    
    let isSuccess = false;
    try {
        fpOleObject.CheckWorkDirWriteRights(); 
        isSuccess = true;
    } catch (error) {
        fpOleObject = null;
    }
    if (!fpOleObject) {
        try {
            fpOleObject = new winax.Object('ExellioFP.FiscalPrinter');  
            console.log('winax ole created!');
            fpOleObject.ArtTablesDir = configService.pathWorkDir;
            //console.log('WorkDirWriteRights', fpOleObject.CheckWorkDirWriteRights());
            isSuccess = true;  
        } catch (error) {
            console.log('Ole error', error.message);
            errorMessageConnect = error.message;
            errorMessage = errorMessageConnect;
            isSuccess = false;
        }
    }
    return isSuccess;
}

const checkOpResult = (errorSourceOp = '', opResult = null) => {
    if (opResult || fpOleObject.LastError == 0) {
		errorMessage = ''
		return true;	
	}else {
	    if (opResult == 0) {
		    errorMessage = '';
            errorSource = '';
		    return true;
        }else {
		    errorMessage = opResult.LastErrorText; 
		    errorSource = errorSourceOp;
		    return false;
        }
    };
};

const openPort = () => {
    
    if (!checkSetOleDbObject()) {
        return false;
    }

	fpOleObject.Debugger(true);  // ввімкнути протоколювання роботи драйверу в файл ExellioFP.log
	//fpOleObject.SetReadTimeout(timeout); // Встановити Таймаут читання для роботи в термінальному режиму
    //
    fpOleObject.OpenPort(configFr.serialConfig.port, configFr.serialConfig.speed);
    //
	if (checkOpResult("OpenPort")) {
        serialNumber = Number(fpOleObject.s6);  
        return true;
    }else {
        fpOleObject.ClosePort();
		return false;
	};
    
}

const sendCommandInfo = async (req, res, next) => {
    
    checkSetOleDbObject();
    //
    res.json({
    status: 'ok',
    message: 'exellioOle2Http server is up',
    configFr: configFr,
    errorMessageConnect,
    errorMessage,
    errorSource,
    pathWorkDir: configService.pathWorkDir,
    workDirWriteRights: fpOleObject ? fpOleObject.CheckWorkDirWriteRights(): 'null'
  });
};

const sendCommand = async (req, res, next) => {
    
    checkSetOleDbObject();
    let resData;
    console.log('sendCommand->Data', (req.body));
    switch (req.body.command) {
        case 'saleReturn':
            resData = opSaleReturn(req.body.data);
            break;
        case 'cashInOut':
            resData = opCashInOut(req.body.data);
            break;
        // case 'openshift':
        //     // openshift
        //     break;
        case 'shiftStatus':
            // resData = opCashInOut(req.body.data);
            break;
        case 'zreport':
            resData = opZReport(req.body.data);
            break;
        case 'xreport':
            resData = opXReport(req.body.data);
            break;
        default:
            errorMessage = `Unknown command ${req.body.command}.`;
            resData = { 
                isError: true,
                errorMessage
            };
            console.log('sendCommand', errorMessage);
    }
    res.json(resData);
  };

/**
 * Виконує створення та фіскалізацію чека, як для продажі так і для повернення
 *
 * @param {Object} opData - об'єкт з даними який передаємо
 * @param {boolean} opData.isReturn - признак, що це чек повернення
 * @param {number} opData.sumCash - сума готівкою
 * @param {number} opData.sumNonCash - сума карткою
 * @param {string} opData.uuid - унікальний id чеку 
 * @param {number} opData.cashierPassword - пароль касиру ккм
 * @param {Array.<{code: string, name: string, price: number, qty: number, tax: number, discount: number}>} opData.products - таблиця товарів для пробиття
 * @returns {Object} - повертає объект з результатом
 */
const opSaleReturn = (opData) => {

    const isFiscalReceipt = true;

    let shiftNumber;
    let receiptNumber;
    
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //openPort
    //////////////////////////////////////////////////////////////////////////////////////////////////
    if (openPort()) {
        if (fpOleObject.IsFiscalOpen) {
			console.log('opSaleReturn', 'canceling crashed / stuck receipt');
			fpOleObject.CancelReceipt(); //скасування відкритого чеку
		};
        let currentOp = '';
        if (isFiscalReceipt) {
            if (!isReturn) { 
                fpOleObject.OpenFiscalReceipt(1, opData.cashierPassword, 1); // Відкриття чеку продаж
                currentOp = 'OpenFiscalReceipt';
            } else {
                fpOleObject.OpenReturnReceipt(1, opData.cashierPassword, 1); // Відкриття чеку повернення
                currentOp = 'OpenReturnReceipt';
            };
        } else {
            fpOleObject.OpenNonfiscalReceipt(); // Відкриття чеку коментарів
            currentOp = 'OpenNonfiscalReceipt';			
        }

        // Якщо помилка відкриття чеку
		if (!checkOpResult(currentOp)) {
            fpOleObject.ClosePort(); 	//закриваємо порт
            console.log(currentOp, errorMessage);
            return {
                isError: true,
                errorMessage
            };
        } else {
            fpOleObject.GetDayInfo(); // Читаємо інформацію з ККМ про НомерЗміни
            if (checkOpResult("GetDayInfo")) {
                shiftNumber = Number(fpOleObject.s9) + 1;
            };
            fpOleObject.GetLastReceiptNum();  // Читаємо інформацію з ККМ про НомерЧеку
            if (checkOpResult("GetLastReceiptNum")) {
                receiptNumber = Number(fpOleObject.s1) + 1;	
            };
        };
    } else {
        console.log('openPort', errorMessage);
        return {
            isError: true,
            errorMessage
        };
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    //printRows
    //////////////////////////////////////////////////////////////////////////////////////////////////
    let sumReceipt = 0;
    for (const productRow of opData.products) {
        sumReceipt += productRow.qty * productRow.price;
        const saleRes = fpOleObject.SaleWC(productRow.code, productRow.name, productRow.tax, 1, productRow.price, productRow.qty, productRow.discount, 0, true, frAdminPassword);
        if (!checkOpResult('SaleWC', saleRes)) {
            fpOleObject.CancelReceipt(); //відміна чеку
            fpOleObject.ClosePort();
            console.log('SaleWC', errorMessage);
            return {
                isError: true,
                errorMessage
            };
            //break;
        }
    }
    
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //closeReceipt
    //////////////////////////////////////////////////////////////////////////////////////////////////
    let resPayment;
    if (isFiscalReceipt) { // Необхідно виконати оплату тільки для фіскального чеку
        if ((opData.sumNonCash > 0) && (opData.sumCash == 0)) {
			fpOleObject.Total(undefined, 4, 0); // Сплата платіжною картою на всю суму чеку, суму чеку отримуємо из ККМ
			resPayment = checkOpResult("TotalCash");
         } else if ((opData.sumNonCash == 0) && (opData.sumCash > 0)) {
			fpOleObject.Total(undefined, 1, opData.sumCash); // Сплата готівкою
			resPayment = checkOpResult("TotalCard");
		} else if ((opData.sumNonCash == 0) && (opData.sumCash == 0)) {
			fpOleObject.Total(undefined, 1, 0); // Сплата готівкою
			resPayment = checkOpResult(Объект, "TotalCash3");	
        } else {						
			fpOleObject.Total(undefined, 4, opData.sumNonCash);  // Сплата платіжною картою 
			fpOleObject.Total(undefined, 1, opData.sumCash);  // Сплата готівкою
			resPayment = checkOpResult("TotalCashCard");		
        };
		if (!resPayment) {
			fpOleObject.CancelReceipt(); //відміна чеку
            console.log('Total', errorMessage);
            return {
                isError: true,
                errorMessage
            };
        };	
	};

    if (isFiscalReceipt) {
		fpOleObject.CloseFiscalReceipt(); // Закриття фіскального чеку
		if (!checkOpResult("CloseFiscalReceipt")) {
            fpOleObject.CancelReceipt(); //відміна чеку	
            console.log('CloseFiscalReceipt', errorMessage);
            return {
                isError: true,
                errorMessage
            }
        };	
    } else {
		fpOleObject.CloseNonfiscalReceipt(); // Закриття нефіскального чеку (чека коментарів)
		if (!checkOpResult("CloseNonfiscalReceipt")) {
            fpOleObject.CancelReceipt(); //відміна чеку	
            console.log('CloseNonfiscalReceipt', errorMessage);
            return {
                isError: true,
                errorMessage
            }
        };	
	};
    console.log('opSaleReturn->success');
    return {
        isError: false,
        errorMessage: '',
        data: { receiptNumber, shiftNumber }
    };
}

/**
 * Виконує внесення та винесення коштів
 *
 * @param {Object} opData - об'єкт з даними який передаємо
 * @param {number} opData.sum - сума внесення / винесення
 * @param {number} opData.cashierPassword - пароль касиру ккм
 * @returns {Object} - повертає результат
 */
const opCashInOut = (opData) => {
	
	if (openPort()) {
		fpOleObject.InOut(opData.sum);
		if (!checkOpResult('InOut')) {
			console.log('InOut', errorMessage);
            return {
                isError: true,
                errorMessage
            }
        };
		fpOleObject.OpenDrawer(); // відкриття грошового ящику
        fpOleObject.ClosePort(); // Закриття СОМ-порту
    } else {
        console.log('openPort', errorMessage);
        return {
            isError: true,
            errorMessage
        }
    }
		
	console.log('opCashInOut->success');
    return {
        isError: false,
        errorMessage: ''
    };
}

const opZReport = (opData) => {
	
    let receiptNumber;
    let shiftNumber;

	if (openPort()) {
		// Перевірка наявності відкритого фіскального чеку в ККМ
		if (fpOleObject.IsFiscalOpen) {
            fpOleObject.CancelReceipt(); //Відміна незакінченного чеку ККМ
        };
			
        //fpOleObject.GetSettingValue(5); // читання налаштування "друк зменшеним шрифтом"			
		//const smallFontMode = fpOleObject.S1; 
		//	
		//fpOleObject.GetSettingValue(7); // читання налаштування "друкувати звіти на контрольній стрічці"
        //const printControlStrike = (!fpOleObject.S1); 
		//				
		fpOleObject.EnableSmallFont(true);
		//fpOleObject.EnableCRReport(true);
			
		fpOleObject.ZReportWC(frAdminPassword); // Друк Z-звіту, очистка таблиці артикулів, видалення всіх артикулів з ФР	
		if (!checkOpResult('ZReportWC')) {
			console.log('ZReportWC', errorMessage);
            return {
                isError: true,
                errorMessage
            }
        } else {
			fpOleObject.GetDayInfo(); // Читаємо інформацію з ККМ про НомереЧеку и НомереЗміни
			if (!checkOpResult('GetDayInfo')) {
				receiptNumber = Number(fpOleObject.s6) + 1;
				shiftNumber = Number(fpOleObject.s9) + 1;
                console.log('GetDayInfo->error', errorMessage);
            };
			//fpOleObject.DelArticle(frAdminPassword,0); // Видалення ВСІХ запрограмованих артикулів в регістраторі
        };
		//	
		fpOleObject.EnableSmallFont(false);
		//	
		fpOleObject.OpenDrawer(); // Відкриття грошового ящику
		fpOleObject.ClosePort();
    } else {
		console.log('openPort', errorMessage);
        return {
            isError: true,
            errorMessage
        }		
	};
	console.log('opZReport->success');
    return {
        isError: false,
        errorMessage: ''
    };
}

const opXReport = (opData) => {
    
    let receiptNumber;
    let shiftNumber;
	
	if (openPort()) {
		// Перевірка наявності відкритого фіскального чеку в ККМ
		if (fpOleObject.IsFiscalOpen) {
			fpOleObject.CancelReceipt(); //Відміна незакінченого чеку ККМ
        };

		fpOleObject.EnableSmallFont(true);
		fpOleObject.EnableCRReport(true);
		//	
		fpOleObject.XReport(frAdminPassword); // Друк Х-звіту
        //
		if (!checkOpResult('XReport')) {
			console.log('XReport', errorMessage);
            return {
                isError: true,
                errorMessage
            }
        } else {
			fpOleObject.GetDayInfo(); // Читаємо информацію з ККМ про НомереЧеку та НомерЗміни
			if (!checkOpResult('GetDayInfo')) {
			    receiptNumber = Number(fpOleObject.s6) + 1;
				shiftNumber = Number(fpOleObject.s9) + 1;
            };
			//
			fpOleObject.EnableSmallFont(false);
			fpOleObject.EnableCRReport(false);
            //
			fpOleObject.ClosePort();
        }
    } else {
		console.log('openPort', errorMessage);
        return {
            isError: true,
            errorMessage
        }		
	};
	console.log('opXReport->success');
    return {
        isError: false,
        errorMessage: ''
    };
}

exports.sendCommandInfo = sendCommandInfo;
exports.sendCommand = sendCommand;