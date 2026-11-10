<#-- 12X-00 -->
<#-- @ftlvariable name="stageInfo" type="com.example.app.domain.stageinfo.dto.StageInfoDto" -->
<#-- @ftlvariable name="featureToggleService" type="com.example.app.platform.toggler.FeatureToggleService" -->

<#function formatPayment number>
  <#if number?floor != number>
    <#return number?string["#,##0.00;;decimalSeparator=_"]?replace(",", " ")?replace("_", ",")?replace(" ", " ") + " ₽">
  <#else>
    <#return number?string["#,##0.00;;decimalSeparator=_"]?replace(",", " ")?replace("_", ",")?replace(" ", " ") + " ₽">
  </#if>
</#function>

<#function normalizePhone phone>
  <#local cleaned = phone?replace("[^0-9]", "", "r")>

  <#if cleaned?starts_with("7") && cleaned?length == 11>
    <#return "8" + cleaned?substring(1)>
  <#else>
    <#return cleaned>
  </#if>
</#function>

<#assign digitWords = {
  "0": "ноль", "1": "один", "2": "два", "3": "три", "4": "четыре",
  "5": "пять", "6": "шесть", "7": "семь", "8": "восемь", "9": "девять"
}>

<#function phoneToWords phone>
  <#local words = []>
  <#list phone?split("") as digit>
    <#local words = words + [digitWords[digit]]>
  </#list>

  <#return words?join(" ")>
</#function>

<#assign unifiedPaymentProcessAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.UnifiedPaymentProcess")>
<#assign onlinePaymentAvailable = featureToggleService.checkFeatureEnable("APP:FLApp.Settings.OnlinePayment")>

<#assign unifiedPaymentLinkAvailable = stageInfo.unifiedPaymentLink?has_content>
<#assign onlinePaymentLinkAvailable = stageInfo.onlinePaymentLink?has_content>
<#assign paymentButtonAvailable = unifiedPaymentProcessAvailable || onlinePaymentAvailable>

<#if unifiedPaymentProcessAvailable && unifiedPaymentLinkAvailable && onlinePaymentLinkAvailable>
  <#assign paymentUri = "deeplink:" + stageInfo.unifiedPaymentLink>
<#elseif !unifiedPaymentProcessAvailable && onlinePaymentLinkAvailable>
  <#assign paymentUri = "path:app/api/v1/" + stageInfo.onlinePaymentLink>
<#elseif stageInfo.repaymentLink??>
  <#assign repaymentAmount = stageInfo.repaymentLink.amount?c?replace(",", ".")>
  <#assign paymentUri = "deeplink:payments/p2p?type=between_my_account&amount=" + repaymentAmount + "&to=" + stageInfo.repaymentLink.account + "&source=loan">
<#else>
  <#assign paymentUri = "deeplink:payments/p2p?type=between_my_account">
</#if>

<#if onlinePaymentLinkAvailable>
  <#assign footerUri = "path:app/api/v1/" + stageInfo.onlinePaymentLink>
<#elseif stageInfo.repaymentLink??>
  <#assign repaymentAmount = stageInfo.repaymentLink.amount?c?replace(",", ".")>
  <#assign footerUri = "deeplink:payments/p2p?type=between_my_account&amount=" + repaymentAmount + "&to=" + stageInfo.repaymentLink.account + "&source=loan">
<#else>
  <#assign footerUri = "deeplink:payments/p2p?type=between_my_account">
</#if>

<#if stageInfo.totalDebt?has_content>
  <#assign totalDebt = formatPayment(stageInfo.totalDebt) />
</#if>
<#assign productName = stageInfo.productName?replace("\"", "\\\"") />
<#assign fullRepaymentAmount = formatPayment(stageInfo.fullRepaymentAmount) />

<#assign courtItems = []>
<#assign orderTypeCode = "">
<#assign serialNumber = "">
<#assign issueDate = "">

<#if stageInfo.sipDetails?has_content>
  <#assign sipDetails = stageInfo.sipDetails />
</#if>

<#if stageInfo.actualExecutoryDocument?has_content>
  <#assign actualExecDoc = stageInfo.actualExecutoryDocument />
  <#assign orderTypeCode = actualExecDoc.orderTypeCode!"" />
  <#if actualExecDoc.serialNumber?has_content>
    <#assign serialNumber = actualExecDoc.serialNumber />
  <#elseif actualExecDoc.civilCaseNumber?has_content>
    <#assign serialNumber = actualExecDoc.civilCaseNumber />
  </#if>
  <#if orderTypeCode == "WRIT">
    <#if actualExecDoc.courtOrderDate?has_content>
      <#assign issueDate = actualExecDoc.courtOrderDate?date("yyyy-MM-dd")?string("dd.MM.yyyy") />
    </#if>
  <#elseif actualExecDoc.courtActStartDate?has_content>
    <#assign issueDate = actualExecDoc.courtActStartDate?date("yyyy-MM-dd")?string("dd.MM.yyyy") />
  <#elseif actualExecDoc.orderIssueDate?has_content>
    <#assign issueDate = actualExecDoc.orderIssueDate?date("yyyy-MM-dd")?string("dd.MM.yyyy") />
  </#if>
  <#if actualExecDoc.amountRecovery?has_content>
    <#assign courtItems = courtItems + [{"title": "Сумма взыскания", "subtitle": formatPayment(actualExecDoc.amountRecovery)}]>
  </#if>
  <#if actualExecDoc.courtDescription?has_content>
    <#assign courtItems = courtItems + [{"title": "Суд", "subtitle": actualExecDoc.courtDescription}]>
  </#if>
  <#if actualExecDoc.courtAddress?has_content>
    <#assign courtItems = courtItems + [{"title": "Адрес", "subtitle": actualExecDoc.courtAddress}]>
  </#if>
</#if>

<#assign documentTitle = "">
<#if orderTypeCode == "WRIT">
  <#assign documentTitle = "Получен судебный приказ">
<#elseif orderTypeCode == "ORDER">
  <#assign documentTitle = "Получен исполнительный лист">
</#if>
<#if serialNumber?has_content>
  <#assign documentTitle = documentTitle + " № " + serialNumber>
</#if>
<#if issueDate?has_content>
  <#assign documentTitle = documentTitle + " от " + issueDate>
</#if>

{
  "paramsForAnalytic": [
    "npl:${stageInfo.npl}",
    "ifrs_kind:${stageInfo.ifrsKind}",
    "stage:${stageInfo.stage}",
    "substage:${orderTypeCode?switch("WRIT", "COURT_WRIT", "ORDER", "ORDER", "NONE")}"
  ],
  "widgets": [
    {
      "type": "Header",
      "title": "Просроченная задолженность\n<#if totalDebt?has_content>${totalDebt}</#if>",
      "subtitle": "${productName} ${fullRepaymentAmount}"
    },
    {
      "type": "Stages",
      "title": "Идёт взыскание задолженности",
      "items": [
        {
          "title": "Связывались с вами, чтобы договориться о погашении долга"
        },
        <#if documentTitle?has_content>
        {
          "title": "${documentTitle}",
          "icon": "ds_ic_24_building",
          "eventForAnalytic": "StageDetails",
          "items": [
            <#list courtItems as item>
              {
                "title": "${item.title}",
                "subtitle": "${item.subtitle?json_string}"
              }<#sep>,</#sep>
            </#list>
          ]
        },
        </#if>
        {
          "title": "Взыскание задолженности по решению суда"
        }
      ]
    },
    {
      "type": "Cell",
      "title": "Чтобы остановить принудительное взыскание, оплатите задолженность"
    },
    {
      "type": "Solutions",
      "title": "Что ещё можно сделать",
      "items": [
        <#if sipDetails?? && sipDetails.fio?has_content && sipDetails.externalPhone?has_content>
          {
            "title": "Узнайте, как сервис может помочь вам с погашением долга",
            "subtitle": "${sipDetails.externalPhone}, с 09:00 до 18:00 мск\nВаш менеджер ${sipDetails.fio}",
            "subtitleVoice": "${phoneToWords(normalizePhone(sipDetails.externalPhone))}, с девяти утра до шести вечера по московскому времени. Ваш менеджер ${sipDetails.fio}",
            "icon": "ds_ic_36_handset:iconPrimary",
            "uri": "tel:${normalizePhone(sipDetails.externalPhone)}",
            "eventForAnalytic": "Call",
            "toggle": "sipStageInfo"
          },
        </#if>
        {
          "title": "Воспользуйтесь мировым соглашением",
          "subtitle": "Реструктуризацией кредита с длительной просрочкой",
          "icon": "ds_ic_36_shaking_hands:iconPrimary",
          "uri": "https://example.com/credits/agreement",
          "eventForAnalytic": "AmicableAgreement"
        },
        {
          "title": "Узнайте, как продать залог",
          "subtitle": "Для погашения долга",
          "icon": "ds_ic_36_house:iconPrimary",
          "uri": "https://example.com/pledge-sale",
          "eventForAnalytic": "PledgeSale"
        },
        {
          "title": "Откройте совместный доступ к кредиту",
          "subtitle": "Попросите близкого помочь вам с оплатой",
          "icon": "ds_ic_36_user_on_user:iconPrimary",
          "uri": "deeplink:sharedfinance/credits",
          "eventForAnalytic": "LoanSharedAccess"
        }
      ]
    }
    <#if paymentButtonAvailable>,
    {
      "type": "ButtonStack",
      "items": [
        {
          "title": "Оплатить",
          "uri": "${paymentUri}",
          "eventForAnalytic": "Payment",
          "footer": {
            "uri": "${footerUri}"
          }
        }
      ]
    }
    </#if>
  ]
}
