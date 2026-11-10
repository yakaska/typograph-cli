<#setting locale="ru_RU">

<#-- @ftlvariable name="haveDetails" type="java.lang.Boolean" -->
<#-- @ftlvariable name="debtInfo" type="com.example.app.domain.productinfo.debtinfo.DebtInfo" -->
<#-- @ftlvariable name="overdueDebtInfo" type="com.example.app.domain.overdue.OverdueDebtInfo" -->
<#-- @ftlvariable name="appealStatus" type="com.example.app.integration.gateway.srvgetappealstatus.dto.GetAppealStatusRs" -->
<#-- @ftlvariable name="privateDetails" type="com.example.app.integration.ekp.privateloandetails.dto.PrivateLoanDetailsDto" -->
<#-- @ftlvariable name="extPrivateLoans" type="com.example.app.integration.ekp.extprivateloanlist.dto.ExtPrivateLoanDto" -->
<#-- @ftlvariable name="havePreApprovedRestructuring" type="java.lang.Boolean" -->
<#-- @ftlvariable name="featureToggleService" type="com.example.app.platform.toggler.FeatureToggleService" -->
<#-- @ftlvariable name="csiParams" type="com.example.app.platform.cms.parameter.csi.CSIParameters" -->
<#-- @ftlvariable name="creditCardInfo" type="com.example.app.platform.person.dto.CreditCard" -->
<#-- @ftlvariable name="repaymentLink" type="com.example.app.domain.repayment.RepaymentLink" -->
<#-- @ftlvariable name="stageInfo" type="com.example.app.domain.stageinfo.dto.StageInfoDto" -->
<#-- @ftlvariable name="bankruptcyInfo" type="com.example.app.domain.stageinfo.dto.BankruptcyInfo" -->
<#-- @ftlvariable name="onlinePaymentLink" type="java.lang.String" -->
<#-- @ftlvariable name="cardBlockingReason" type="com.example.app.integration.gateway.cardstatus.dto.CardBlockingReason" -->
<#-- @ftlvariable name="debtCount" type="java.lang.Integer" -->
<#-- @ftlvariable name="cardBannerAvailable" type="java.lang.Boolean" -->
<#-- @ftlvariable name="promiseReminder" type="com.example.app.domain.paypromise.PayPromiseReminderInfo" -->
<#-- @ftlvariable name="unifiedPaymentLink" type="java.lang.String" -->

<#assign restructuringAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.iOSSettings.RestructuringAllowed")/>
<#assign creditHolidaysAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.CreditHolidaysAllowed")/>
<#assign legalCreditHolidaysAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.LegalCreditHolidaysAllowed")/>
<#assign mortgageHolidaysAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.MbLegalMortgageHolidaysAllowed")/>
<#assign chatSpecialistAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.ChatSpecialist")/>
<#assign newRestructuringAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.RestructuringAllowed")/>
<#assign promiseToPayAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.PromiseToPay")/>
<#assign stageInfoAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.StageInfo")/>
<#assign stageDetailsInfoAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.StageDetailsInfo")/>
<#assign reasonBlockingCardBannerAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.ReasonBlockingCardBanner")/>
<#assign unifiedPaymentProcessAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.UnifiedPaymentProcess")/>
<#assign creditPaymentAccountEnabled = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.DropoutCreditPaymentAccount")>

<#assign cardBannerContentAvailable = cardBannerAvailable/>
<#assign stageInfoContentAvailable = (stageInfoAvailable || stageDetailsInfoAvailable) && stageInfo?has_content/>
<#assign bankruptcyInfoAvailable = bankruptcyInfo??/>
<#assign reasonBlockingCardBannerContentAvailable = reasonBlockingCardBannerAvailable && cardBlockingReason??/>
<#assign promiseReminderBannerContentAvailable = promiseReminder?? />

<#if debtInfo??>
  <#if debtInfo.debtDurationInDays??>
    <#assign debtDurationInDays = debtInfo.debtDurationInDays>
  <#else>
    <#assign debtDurationInDays = 0/>
  </#if>
<#else>
  <#if creditCardInfo??>
    <#assign debtDurationInDays = creditCardInfo.debtDurationInDays/>
  <#else>
    <#assign debtDurationInDays = 0/>
  </#if>
</#if>

<#assign isKPS = creditPaymentAccountEnabled && creditCardInfo?? && creditCardInfo.isKPS()>

<#if reasonBlockingCardBannerContentAvailable>
  <#assign BLOCK_TYPES = {
  "START_RESTRUCTURING": "settlement",
  "SETTLEMENT_BLOCK": "settlement",
  "START_LEGAL_HOLIDAYS": "settlement",
  "START_LEGAL_HOLIDAYS_FZ_353": "settlement",
  "START_MOBILIZATION": "settlement",
  "START_NOTARY_RESTRUCTURING": "settlement",
  "OVERDUE_BLOCK": "overdue"
  }>

  <#assign blockType = BLOCK_TYPES[cardBlockingReason.getBlockingType()?string]!''>
  <#assign cardName = isKPS?then("Счёт кредитной карты", "Кредитная карта")>

  <#if blockType == "settlement">
    <#assign hasUnblockDate = cardBlockingReason.getPlanUnblockingDateTime()??>
    <#assign blockingReasonTitle = cardName + " заблокирован" + (isKPS?then("", "а")) +
    (hasUnblockDate?then(" до ${cardBlockingReason.getPlanUnblockingDateTime()?string('dd.MM.yyyy')}", ""))>
    <#assign blockingReasonSubtitle = "Потому что вы подали заявку на программу поддержки">

  <#elseif blockType == "overdue">
    <#assign blockingReasonTitle = cardName + " заблокирован" + (isKPS?then("", "а"))>
    <#assign blockingReasonSubtitle = "После оплаты просроченной задолженности" +
    ((debtCount == 1)?then("", " по всем кредитам")) +
    " разблокируем " + (isKPS?then("его", "её")) + " в течение 5 дней">
  </#if>
</#if>

<#function formatPayment number>
  <#if number?floor != number>
    <#return number?string["#,##0.00;;decimalSeparator=_"]?replace(",", " ")?replace("_", ",")?replace(" ", " ") + " ₽">
  <#else>
    <#return number?string["#,##0;;decimalSeparator=_"]?replace(",", " ")?replace("_", ",")?replace(" ", " ") + " ₽">
  </#if>
</#function>

<#assign promisToPayButtonAvailable = promiseToPayAvailable && overdueDebtInfo?? && overdueDebtInfo.allLoansWithinDelayPeriod/>
<#assign chatButtonAvailable = chatSpecialistAvailable && debtDurationInDays gt 10/>
<#assign onlinePaymentButtonAvailable = onlinePaymentLink??/>

<#assign analyticParams = []>

<#if haveDetails>
  <#if debtInfo??>
    <#if extPrivateLoans?? && extPrivateLoans.ifrsProductCode?has_content>
      <#assign ifrsKind = extPrivateLoans.ifrsProductCode>
    <#else>
      <#assign ifrsKind = "EXT_PRIVATE_NULL">
    </#if>
    <#assign analyticParams = analyticParams +
    ["ifrs_kind:${ifrsKind}", "npl:${debtInfo.nplBucket!'NPL0'}"]>
  <#else>
    <#if creditCardInfo?? && creditCardInfo.nplBucket?has_content>
      <#assign nplBucket = creditCardInfo.nplBucket>
    <#else>
      <#assign nplBucket = "NPL0">
    </#if>
    <#assign analyticParams = analyticParams + ["npl:${nplBucket}", "ifrs_kind:КК"]>
  </#if>
<#else>
  <#assign analyticParams = analyticParams + ["npl:NPL0"]>
</#if>

<#if stageInfoContentAvailable>
  <#assign analyticParams = analyticParams + ["stage:${stageInfo.stage}"]>
<#elseif bankruptcyInfoAvailable>
  <#assign analyticParams = analyticParams + ["stage:${bankruptcyInfo.stage}"]>
</#if>
<#if reasonBlockingCardBannerContentAvailable>
  <#assign analyticParams = analyticParams +["blockingCategory:${cardBlockingReason.getBlockingCategory()?string}"]>
</#if>

<#if cardBannerContentAvailable>
  <#assign activeBannerType = "CreditCardBlocking">
<#elseif promiseReminderBannerContentAvailable>
  <#assign activeBannerType = "PromiseReminder">
<#elseif stageInfoContentAvailable>
  <#assign activeBannerType = "StageInfo">
<#elseif bankruptcyInfoAvailable>
  <#assign activeBannerType = "bankruptcy">
<#else>
  <#assign activeBannerType = "">
</#if>

<#if activeBannerType == "bankruptcy">
  <#assign analyticParams = analyticParams + ["substage:NONE"]>
</#if>

<#if activeBannerType?has_content>
  <#assign analyticParams = analyticParams + ["BannerType:${activeBannerType}"]>
</#if>

<#macro debtHintBanner>
  <#if activeBannerType == "CreditCardBlocking">
    {
    "type": "HintBanner",
    <#if isKPS>
      "title": "Счёт кредитной карты будет заблокирован ${overdueDebtInfo.cardBlockDate?string('d MMMM')}",
    <#else>
      "title": "Кредитная карта будет заблокирована ${overdueDebtInfo.cardBlockDate?string('d MMMM')}",
    </#if>
    <#if overdueDebtInfo.overdueCount == 1>
      "subtitle": "Если не оплатите задолженность по кредиту",
    <#else>
      "subtitle": "Если не оплатите задолженность по всем кредитам",
    </#if>
    "icon": "ds_ic_36_exclamation",
    "eventForAnalytic": "HintBanner"
    },
  <#elseif activeBannerType == "PromiseReminder">
    {
    "type": "HintBanner",
    <#if promiseReminder.isSingleLoan()>
      "title": "Не забудьте оплатить ${formatPayment(promiseReminder.amount)}",
    <#else>
      "title": "Не забудьте оплатить ${formatPayment(promiseReminder.amount)} по всем кредитам",
    </#if>
    "subtitle": "Обещание об оплате действует до ${promiseReminder.promiseDate?string('d MMMM')}",
    "icon": "ds_ic_36_info",
    "style": "accent",
    "eventForAnalytic": "HintBanner"
    },
  <#elseif activeBannerType == "StageInfo">
    {
    "type": "HintBanner",
    "title": "${stageInfo.title}",
    <#if stageInfo.description?has_content>
      "subtitle": "${stageInfo.description}",
    </#if>
    "icon": "ds_ic_36_info",
    "footer": {
    "title": "Подробнее",
    "deeplink": "loans/debtinfopage/stage"
    },
    "eventForAnalytic": "HintBanner"
    },
  <#elseif activeBannerType == "bankruptcy">
    {
    "type": "HintBanner",
    <#if bankruptcyInfo.completionDate??>
      "title": "Решение суда о признании банкротом принято ${bankruptcyInfo.completionDate?string('d MMMM')}",
      "subtitle": "Обновим информацию по кредиту в приложении до ${bankruptcyInfo.infoUpdateDate?string('d MMMM')}",
    <#else>
      "title": "Получили решение суда о признании банкротом",
      "subtitle": "Обновим информацию по кредиту в течение двух месяцев",
    </#if>
    "icon": "ds_ic_36_info",
    "style": "accent",
    "eventForAnalytic": "HintBanner"
    },
  </#if>
</#macro>

{
"haveDetails": ${haveDetails?c},
"paramsForAnalytic": [
<#list analyticParams as param>
  "${param}"<#sep>,
</#list>
],
"widgets": [
<#if haveDetails>
  <#if debtInfo??>
    {
    "type": "Header",
    "title": "Просроченная задолженность"
    <#if debtInfo.loanType?has_content && debtInfo.loanAmount??>,
      "subtitle": "${debtInfo.loanType?replace("\"", "\\\"")} ${formatPayment(debtInfo.loanAmount)}"
    </#if>
    },
    <@debtHintBanner/>
    {
    "type": "Summary",
    <#if debtInfo.currentTotalDebt??>
      "title": "Задолженность на сегодня \n${formatPayment(debtInfo.currentTotalDebt)}",
    </#if>
    "subtitle": "Оплатите сейчас, просрочка закроется до конца дня",
    "eventForAnalytic": "TodayOverdueAmount",
    "items": [
    {
    "title": "Просроченный основной долг"
    <#if debtInfo.currentCreditDebt??>,
      "subtitle": "${formatPayment(debtInfo.currentCreditDebt)}"
    </#if>
    },
    {
    "title": "Просроченные проценты"
    <#if debtInfo.currentOverpayDebt??>,
      "subtitle": "${formatPayment(debtInfo.currentOverpayDebt)}"
    </#if>
    },
    {
    "title": "Неустойка"
    <#if debtInfo.currentPennyDebt??>,
      "subtitle": "${formatPayment(debtInfo.currentPennyDebt)}"
    </#if>
    }
    <#if debtInfo.debtDurationInDays??>,
      {
      "title": "Дней просрочки",
      "subtitle": "${debtDurationInDays?string["#,##0;; decimalSeparator=_"]?replace(",", " ")?replace("_", ",")?replace(" ", " ")}"
      }
    </#if>
    ],
    "footer": {
    "title": "Проценты и неустойка начисляются каждый день, поэтому сумма растёт"
    }
    },
  <#else>
    {
    "type": "Header",
    "title": "Просроченная задолженность",
    "subtitle": "${creditCardInfo.productName?replace("\"", "\\\"")} ·· ${creditCardInfo.cardNumber[creditCardInfo.cardNumber?length-4..]}"
    },
    <@debtHintBanner/>
    {
    "type": "Summary",
    "title": "Задолженность на сегодня \n${formatPayment(creditCardInfo.ovdAmount)}",
    "subtitle": "Оплатите сейчас, просрочка закроется до конца дня",
    "eventForAnalytic": "TodayOverdueAmount",
    "items": [
    {
    "title": "Дней просрочки",
    "subtitle": "${debtDurationInDays?string["#,##0;; decimalSeparator=_"]?replace(",", " ")?replace("_", ",")?replace(" ", " ")}"
    }
    ]
    },
  </#if>
<#else>
  {
  "type": "Header",
  "title": "Просроченная задолженность"
  },
</#if>
{
"type": "CardButtons",
"items": [
<#if unifiedPaymentProcessAvailable && unifiedPaymentLink??>
  {
  "title": "Оплатить",
  "icon": "ds_ic_24_wallet",
  <#if onlinePaymentButtonAvailable>
    "deeplink": "${unifiedPaymentLink}",
  <#else>
    <#if repaymentLink??>
      "deeplink": "payments/p2p?type=between_my_account&amount=${repaymentLink.amount?c?replace(",", ".")}&to=${repaymentLink.account}&source=loan",
    <#else>
      "deeplink": "payments/p2p?type=between_my_account",
    </#if>
  </#if>
  "eventForAnalytic": "PayButton"
  },
<#else>
  {
  <#if debtInfo??>
    "title": "Пополнить счёт",
  <#else>
    "title": "Внести платёж",
  </#if>
  "subtitle": "с банковской карты",
  "description": "Погасить",
  "icon": "ds_ic_36_bank_alt1",
  <#if repaymentLink??>
    "deeplink": "payments/p2p?type=between_my_account&amount=${repaymentLink.amount?c?replace(",", ".")}&to=${repaymentLink.account}&source=loan",
  <#else>
    "deeplink": "payments/p2p?type=between_my_account",
  </#if>
  "eventForAnalytic": "TopUpAccount"
  },
  <#if onlinePaymentButtonAvailable>
    {
    "title": "Оплатить картой",
    "subtitle": "любого банка",
    "icon": "ds_ic_36_card",
    "uri": "path:app/api/v1/${onlinePaymentLink}",
    "eventForAnalytic": "OnlinePayment"
    },
  </#if>
</#if>
<#if chatButtonAvailable && (unifiedPaymentProcessAvailable || !onlinePaymentButtonAvailable)>
  {
  "title": "Чат",
  "icon": "ds_ic_24_speech_bubble_on_bubble",
  "deeplink": "support-chat/?split=solution_debt&widget=context",
  "eventForAnalytic": "ExpertChat"
  },
</#if>
{
"title": "Действия",
"icon": "ds_ic_24_dots_horizontal",
"footer": {
"title": "Действия",
"items": [
<#if !unifiedPaymentProcessAvailable && onlinePaymentButtonAvailable && chatButtonAvailable>
  {
  "title": "Задать вопрос специалисту",
  "icon": "ds_ic_36_rectangle_speech_bubble_on_speech_bubble:iconPrimary",
  "deeplink": "support-chat/?split=solution_debt&widget=context",
  "eventForAnalytic": "ExpertChat"
  },
</#if>
<#if promisToPayButtonAvailable>
  {
  "title": "Оплачу позже",
  "icon": "ds_ic_36_shaking_hands:iconPrimary",
  "deeplink": "loanrestructuring/promisetopay",
  "eventForAnalytic": "PromiseToPay"
  },
</#if>
{
"title": "Справка о задолженности",
"icon": "ds_ic_36_document:iconPrimary",
"deeplink": "StatementsAndReferences?statement=ALL_OBLIGATIONS_CERTIFICATE",
"eventForAnalytic": "CertificateOfDebt"
}
]
}
}
]
},
<#if stageInfoContentAvailable && cardBannerContentAvailable>
  {
  "type": "Stages",
  "title": "${stageInfo.title}",
  <#if stageInfo.description?has_content>
    "subtitle": "${stageInfo.description}",
  </#if>
  "footer": {
  "title": "Подробнее",
  "deeplink": "loans/debtinfopage/stage",
  "eventForAnalytic": "StageInfoBanner"
  }
  },
</#if>
<#if reasonBlockingCardBannerContentAvailable>
  {
  "type": "ModuleCell",
  "title": "${blockingReasonTitle}",
  "subtitle": "${blockingReasonSubtitle}",
  "icon": "ds_ic_24_card:iconPrimary",
  "eventForAnalytic": "CardBlockingReasonBanner"
  },
</#if>
{
"type": "SupportPrograms",
"title": "Программы поддержки",
"subtitle": "Если возникли временные трудности с оплатой кредита, сервис может предложить решение",
"items": [
<#if restructuringAvailable || newRestructuringAvailable>
  <#if havePreApprovedRestructuring && !creditCardInfo??>
    {
    "title": "Одобренное предложение реструктуризации",
    "subtitle": "Мгновенное оформление",
    "description": "Узнать больше",
    "personalized": true,
    <#if newRestructuringAvailable>
      "deeplink": "loanrestructuring/preofferedRestructuring",
      "eventForAnalytic": "SupportPrograms PreofferedRestructuring"
    <#else>
      "deeplink": "loanrestructuring/restructuring",
      "eventForAnalytic": "SupportPrograms Restructuring"
    </#if>
    }
  <#else>
    {
    "title": "Реструктуризация кредитов",
    "subtitle": "Льготный период с уменьшением платежа на гибких условиях",
    "description": "Узнать больше",
    "deeplink": "loanrestructuring/restructuring",
    "eventForAnalytic": "SupportPrograms Restructuring"
    }
  </#if>
</#if>
<#if creditHolidaysAvailable || legalCreditHolidaysAvailable>
  <#if restructuringAvailable || newRestructuringAvailable>,</#if>
  {
  "title": "Кредитные каникулы",
  "subtitle": "Льготный период для заёмщиков по закону № 353-ФЗ",
  "description": "Узнать больше",
  <#if legalCreditHolidaysAvailable>
    "deeplink": "loanrestructuring/creditholidays353fz",
  <#else>
    "deeplink": "loanrestructuring/restructuring",
  </#if>
  "eventForAnalytic": "SupportPrograms CreditHolidays353FZ"
  }
</#if>
<#if mortgageHolidaysAvailable>
  <#if restructuringAvailable || creditHolidaysAvailable || legalCreditHolidaysAvailable || newRestructuringAvailable>,</#if>
  {
  "title": "Ипотечные каникулы",
  "subtitle": "Льготный период для ипотечных заёмщиков по закону № 353-ФЗ",
  "description": "Узнать больше",
  "deeplink": "loanrestructuring/legalmortgageholidays",
  "eventForAnalytic": "SupportPrograms LegalMortgageHolidays"
  }
</#if>
]
},
{
"type": "Promo",
"description": "ScreenLoansFooter"
},
{
"type": "SurveyStarsRestEntryPoint",
"title": "${csiParams.title}",
"deeplink": "android-app://com.example.app/customersurvey?flowName=singlePage&eventTypeId=395&chance=1_3",
"launcherFeatureName": "${csiParams.launcherFeatureName}"
}
]
}
