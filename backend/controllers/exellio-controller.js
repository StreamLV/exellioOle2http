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

    //ПарольАдминистратораККМ = "0000";
	//ПарольКассираККМ = "0000";

	fpOleObject.Debugger(true);  // ввімкнути протоколювання роботи драйверу в файл ExellioFP.log
	//fpOleObject.SetReadTimeout(timeout); // Встановити Таймаут читання для роботи в термінальному режиму
    //
    fpOleObject.OpenPort(configFr.serialConfig.port, configFr.serialConfig.speed);
    //
	if (checkOpResult("OpenPort")) {
        serialNumber = fpOleObject.s6;  
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
    pathWorkDir: configService.pathWorkDir,
    workDirWriteRights: fpOleObject ? fpOleObject.CheckWorkDirWriteRights(): 'null'
  });
};

const sendCommand = async (req, res, next) => {
    
    checkSetOleDbObject();
    switch (req.body.command) {
        case 'saleReturn':
            opSaleReturn(req.body.data);
            break;
        case 'putgetmoney':
            opPutGetMoney(req.body.data);
            break;
        // case 'openshift':
        //     // openshift
        //     break;
        case 'zreport':
            opZReport(req.body.data);
            break;
        case 'xreport':
            opXReport(req.body.data);
            break;
        default:
            console.log(`Unknown command ${req.body.command}.`);
    }
    
    res.json({
      status: 'ok',
      message: 'exellioOle2Http server is up',
      configFr: configFr,
    });
  };

/**
 * Виконує створення та фіскалізацію чека, як для продажі так і для повернення
 *
 * @param {Object} opData - об'єкт з даними який передаємо
 * @param {boolean} opData.isReturn - признак, що це чек повернення
 * @param {number} opData.sumCash - сума готівкою
 * @param {number} opData.sumNonCash - сума карткою
 * @param {number} opData.cashierPassword - пароль касиру ккм
 * @param {Array.<{code: string, name: string, price: number, qty: number, tax: number, discount: number}>} opData.products - таблиця товарів для пробиття
 * @returns {Type} - повертає результат
 */
const opSaleReturn = (opData) => {

    const isFiscalReceipt = true;

    let shiftNumber = '';
    let receiptNumber = '';
    
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
            //Результат = мОшибкаНеизвестно;
        } else {
            fpOleObject.GetDayInfo(); // Читаємо інформацію з ККМ про НомерЗміни
            if (checkOpResult("GetDayInfo")) {
                shiftNumber = Число(fpOleObject.s9) + 1;
            };
            fpOleObject.GetLastReceiptNum();  // Читаємо інформацію з ККМ про НомерЧеку
            if (checkOpResult("GetLastReceiptNum")) {
                receiptNumber = Число(fpOleObject.s1) + 1;	
            };
        };
    } else {
        console.log('conncetion error');
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
            break;
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
        };	
	};

    if (isFiscalReceipt) {
		fpOleObject.CloseFiscalReceipt(); // Закриття фіскального чеку
		if (!checkOpResult("CloseFiscalReceipt")) {
            fpOleObject.CancelReceipt(); //відміна чеку	
        };	
    } else {
		fpOleObject.CloseNonfiscalReceipt(); // Закриття нефіскального чеку (чека коментарів)
		if (!checkOpResult("CloseNonfiscalReceipt")) {
            fpOleObject.CancelReceipt(); //відміна чеку	
        };	
	};

}

const opPutGetMoney = (opData) => {
    Результат  = мНетОшибки;
	
	Если ОткрытьПорт(Объект, Объект.Параметры) = мНетОшибки Тогда
		Объект.Драйвер.InOut(Сумма);
		Если Не ПроверитьРезультатС(Объект, "InOut") Тогда
			Результат = мОшибкаНеизвестно;
		КонецЕсли;
		Объект.Драйвер.OpenDrawer(); // Открытие денежного ящика
        Объект.Драйвер.ClosePort(); // Закрытие СОМ-порта
	Иначе
		Результат = мОшибкаПриПодключении;		
	КонецЕсли;
		
	Возврат Результат;
}

const opZReport = (opData) => {
    Результат          = мНетОшибки;
	
	Если ОткрытьПорт(Объект, Объект.Параметры) = мНетОшибки Тогда
			// Проверка наличия открытого фискального чека в ККМ
		 	Если Объект.Драйвер.IsFiscalOpen Тогда
				Объект.Драйвер.CancelReceipt(); //Отмена незавершенного чека ККМ
			КонецЕсли;
			
			
			Ф = ПолучитьФорму("НастройкиОтчета");
			Ф.ЧтоТоИзменилось = Ложь;
			Ф.фПоКЛ = Истина;
			
			Объект.Драйвер.GetSettingValue(5); // чтение настройки "печать уменьшенным шрифтом"			
			Ф.фМШ = Булево(Число(Объект.Драйвер.S1)); 
			
			//Объект.Драйвер.GetSettingValue(7); // чтение настройки "печатать отчеты на контрольной ленте"
			//Ф.фПоКЛ = Не Булево(Число(Объект.Драйвер.S1)); 
						
			Ф.ЭлементыФормы.фПоКЛ.Доступность = Ложь;
			
			
			Если Ф.ОткрытьМодально() <> КодВозвратаДиалога.ОК Тогда
				Возврат	мОшибкаНеизвестно;		
			КонецЕсли;	

			Если Ф.ЧтоТоИзменилось Тогда				
				Объект.Драйвер.EnableSmallFont(Ф.фМШ);
				//Объект.Драйвер.EnableCRReport(Ф.фПоКЛ);
			КонецЕсли;
			
			
			Объект.Драйвер.ZReportWC(ПарольАдминистратораККМ); // Печать Z-отчета, очистка таблицы артикулов, удаление всех артикулов из ФР	
			Если Не ПроверитьРезультатС(Объект, "ZОтчет") Тогда
				Результат = мОшибкаНеизвестно;
			Иначе
				Объект.Драйвер.GetDayInfo(); // Читаем информацию из ККМ о НомереЧека и НомереСмены
				Если Не ПроверитьРезультатС(Объект, "GetDayInfo") Тогда
					   НомерЧека = Число(Объект.Драйвер.s6)+1;
					   НомерСмены = Число(Объект.Драйвер.s9)+1;
		        КонецЕсли;
				//Объект.Драйвер.DelArticle(ПарольАдминистратораККМ,0); // Удаление ВСЕХ запрограммированных артикулов в регистраторе
				//ОчиститьАртикулы();
			КонецЕсли;
			
			Если Ф.ЧтоТоИзменилось Тогда
				Если Не Ф.ФЗаписать Тогда
					Объект.Драйвер.EnableSmallFont(Не Ф.фМШ);	
				КонецЕсли
			КонецЕсли;
			
			Объект.Драйвер.OpenDrawer(); // Открытие денежного ящика
			Объект.Драйвер.ClosePort();
	Иначе
			Результат = мОшибкаПриПодключении;		
	КонецЕсли;
	Возврат Результат;
}

const opXReport = (opData) => {
    Результат = мНетОшибки;
	
	Если ОткрытьПорт(Объект, Объект.Параметры) = мНетОшибки Тогда
			// Проверка наличия открытого фискального чека в ККМ
		 	Если Объект.Драйвер.IsFiscalOpen Тогда
				Объект.Драйвер.CancelReceipt(); //Отмена незавершенного чека ККМ
			КонецЕсли;
			
			Ф = ПолучитьФорму("НастройкиОтчета");
			Ф.ЧтоТоИзменилось = Ложь;
			
			Объект.Драйвер.GetSettingValue(5); // чтение настройки "печать уменьшенным шрифтом"
			//Сообщить(Объект.Драйвер.S1);
			
			Ф.фМШ = Булево(Число(Объект.Драйвер.S1)); 
			
			Объект.Драйвер.GetSettingValue(7); // чтение настройки "печатать отчеты на контрольной ленте"
			//Сообщить(Объект.Драйвер.S1);
			
			Ф.фПоКЛ = Не Булево(Число(Объект.Драйвер.S1)); 

			
			Если Ф.ОткрытьМодально() <> КодВозвратаДиалога.ОК Тогда
				Возврат	мОшибкаНеизвестно;		
			КонецЕсли;	

			Если Ф.ЧтоТоИзменилось Тогда
				//Сообщить("ЧтоТоИзменилось");
				Объект.Драйвер.EnableSmallFont(Ф.фМШ);
				Объект.Драйвер.EnableCRReport(Ф.фПоКЛ);
			КонецЕсли;
			
			Объект.Драйвер.XReport(ПарольАдминистратораККМ); // Печать Х-отчета
			Если Не ПроверитьРезультатС(Объект, "XReport") Тогда
				Результат = мОшибкаНеизвестно;
			Иначе
				Объект.Драйвер.GetDayInfo(); // Читаем информацию из ККМ о НомереЧека и НомереСмены
				Если Не ПроверитьРезультатС(Объект, "GetDayInfo") Тогда
					   НомерЧека = Число(Объект.Драйвер.s6) + 1;
					   НомерСмены = Число(Объект.Драйвер.s9) + 1;
		        КонецЕсли;
			КонецЕсли;
			
			Если Ф.ЧтоТоИзменилось Тогда
				Если Не Ф.ФЗаписать Тогда
					Объект.Драйвер.EnableSmallFont(Не Ф.фМШ);
					Объект.Драйвер.EnableCRReport(Не Ф.фПоКЛ);
				КонецЕсли;
			КонецЕсли;

			
			Объект.Драйвер.ClosePort();
	Иначе
			Результат = мОшибкаПриПодключении;		
	КонецЕсли;
	Возврат Результат;
}

exports.sendCommandInfo = sendCommandInfo;
exports.sendCommand = sendCommand;