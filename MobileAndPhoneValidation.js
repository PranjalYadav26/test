import { LightningElement, track, wire, api } from "lwc";
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getMobileWebServiceInterface from "@salesforce/apex/MobileAndPhoneValidationController.getMobileWebServiceInterface";
import getEmailWebServiceInterface from "@salesforce/apex/MobileAndPhoneValidationController.getEmailWebServiceInterface";

import ACC_MOBILE_NUMBER from '@salesforce/schema/Account.Mobile__c';
import ACC_EMAIL from '@salesforce/schema/Account.Email__c';

import FA_PRIMARYOWNER_ID from '@salesforce/schema/FinServ__FinancialAccount__c.FinServ__PrimaryOwner__c';
import FA_MOBILE_NUMBER from '@salesforce/schema/FinServ__FinancialAccount__c.FinServ__PrimaryOwner__r.Mobile__c';
import FA_EMAIL from '@salesforce/schema/FinServ__FinancialAccount__c.FinServ__PrimaryOwner__r.Email__c';


export default class MobileAndPhoneValidation extends LightningElement {

  @api recordId;
  @api objectApiName;

  @track mobileval;
  @track emailval;

  @track disableSaveBtn = true;
  @track showSpinner = false;

  accRecordId;

  currentEmailValue;
  currentMobileValue;

  //mobile verification constants
  mobileVerificationMessage;
  mobileVerificationIconName;
  mobileVerificationVariant;
  mobileVerificationStyle;
  mobileVerificationStatus;
  mobileVerifyClicked = false; // determine if verify button is clicked
  validMobile = false;
  mobileCorrectFormat = true;
  mobileDateDetails;

  //email verification constants
  emailVerificationMessage;
  emailVerificationIconName;
  emailVerificationVariant;
  emailVerificationStyle;
  emailVerificationStatus;
  emailVerifyClicked = false; // determine if verify button is clicked
  validMobile = false;
  emailCorrectFormat = true;
  emailDateDetails;


  connectedCallback() {
    if (this.objectApiName === 'Account') {
      this.accFields = [ACC_MOBILE_NUMBER, ACC_EMAIL];
    } else if (this.objectApiName === 'FinServ__FinancialAccount__c') {
      this.accFields = [FA_PRIMARYOWNER_ID, FA_MOBILE_NUMBER, FA_EMAIL];
    }
  }

  @wire(getRecord, {
    recordId: '$recordId',
    fields: '$accFields'
  }) accountDetails({ error, data }) {
    if (data) {
      if (this.objectApiName === 'Account') {
        this.mobileval = getFieldValue(data, ACC_MOBILE_NUMBER);
        this.emailval = getFieldValue(data, ACC_EMAIL);
        this.accRecordId = this.recordId;
        this.currentEmailValue = this.emailval;
        this.currentMobileValue = this.mobileval;
      } else if (this.objectApiName === 'FinServ__FinancialAccount__c') {
        this.mobileval = getFieldValue(data, FA_MOBILE_NUMBER);
        this.emailval = getFieldValue(data, FA_EMAIL);
        this.accRecordId = getFieldValue(data, FA_PRIMARYOWNER_ID);
        this.currentEmailValue = this.emailval;
        this.currentMobileValue = this.mobileval;
      }
    } else if (error) {
      console.log('get Record ERROR ', error);
      let event = new ShowToastEvent({
        title: 'Error!',
        message: error,
        variant: 'error',
        mode: 'dismissable'
      });
      this.dispatchEvent(event);
    }
  }

  getMobileVerificationResponse(event) {
    this.showSpinner = true;
    this.mobileVerifyClicked = true;

    let mobileNumber = this.mobileval;
    let css =
      "slds-text-body--small slds-p-right_small slds-p-top_xx-small slds-p-bottom_x-small ";
    let message = "";
    let eStyle = "";
    let iconName = "";
    let variant = "";
    let status;
    let mobile = this.mobileval.replace(/[+() ]/g, "");
    //console.log('mobile correct format?',this.mobileCorrectFormat)

    if (this.mobileCorrectFormat == false) {
      this.mobileVerificationMessage = "Please Enter a correctly Formatted Phone Number";
      this.mobileVerificationIconName = "utility:clear";
      this.mobileVerificationVariant = "error";
      this.mobileVerificationStyle = css + "verification-message_error";
      this.mobileVerificationStatus = "";
      this.mobileDateDetails = "";
      this.disableSaveBtn = true;
      this.showSpinner = false;
    } else if (this.mobileval.startsWith("04") && mobile.length == 10) {
      // AU
      mobileNumber = mobileNumber.replace("04", "614");
    } else if (
      this.mobileval.startsWith("02") &&
      mobile.length <= 11 &&
      mobile.length >= 9
    ) {
      // NZ
      mobileNumber = mobileNumber.replace("02", "642");
    }
    console.log(mobileNumber);
    console.log(this.mobileCorrectFormat);
    if (this.mobileCorrectFormat) {
      getMobileWebServiceInterface()
        .then((result) => {
          const date = new Date();
          let todayDate = date
            .toLocaleDateString("en-GB", {
              day: "numeric",
              month: "numeric",
              year: "numeric"
            })
            .replace(/ /g, "/");
          const url = result["url"];
          const params = {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Auth-Token": result["authToken"],
              "Timeout-Seconds": result["timeout"]
            },
            body: '{"number":"' + mobileNumber + '"}'
          };

          fetch(url, params).then((response) => {
            this.statusCode = response.status;
            console.log("statusCode", this.statusCode);
            return response.json();
          })
            .then((jsonResponse) => {
              if (this.statusCode == 200 && jsonResponse["result"] != undefined) {
                let responseData = jsonResponse["result"];
                let confidence = responseData["confidence"];
                switch (confidence) {
                  case "Verified":
                    message = "Successfully verified as reachable";
                    iconName = "utility:success";
                    variant = "success";
                    eStyle = css + "verification-message_verified";
                    status = "Verified";
                    this.validMobile = true;
                    break;
                  case "Unverified":
                    message = "Mobile is unreachable";
                    iconName = "utility:clear";
                    variant = "error";
                    eStyle = css + "verification-message_error";
                    status = "Unverified";
                    this.validMobile = false;
                    break;
                  case "Unknown":
                    message =
                      "Unable to verify mobile but it may be correct";
                    iconName = "utility:success";
                    variant = "brand";
                    eStyle = css + "verification-message_bare";
                    status = "Unknown";
                    this.validMobile = false;
                    break;
                  case "Absent":
                    message =
                      "Successfully verified but not currently reachable";
                    iconName = "utility:success";
                    variant = "brand";
                    eStyle = css + "verification-message_bare";
                    status = "Absent";
                    this.validMobile = true;
                    break;
                  case "Teleservice not provisioned":
                    message = "Mobile is unreachable";
                    iconName = "utility:clear";
                    variant = "error";
                    eStyle = css + "verification-message_error";
                    status = "Teleservice not provisioned";
                    this.validMobile = false;
                    break;
                  case "No coverage":
                    message = "Mobile is unreachable";
                    iconName = "utility:clear";
                    variant = "error";
                    eStyle = css + "verification-message_error";
                    status = "No coverage";
                    this.validMobile = false;
                    break;
                  case "Dead":
                    message = "Mobile is unreachable";
                    iconName = "utility:clear";
                    variant = "error";
                    eStyle = css + "verification-message_error";
                    status = "Dead";
                    this.validMobile = false;
                    break;
                }
                this.mobileVerificationMessage = message;
                this.mobileVerificationIconName = iconName;
                this.mobileVerificationVariant = variant;
                this.mobileVerificationStyle = eStyle;
                this.mobileVerificationStatus = status;
                this.mobileDateDetails = " (as at " + todayDate + ")";
                this.showSpinner = false;
                this.enableSaveButton();
              }

            });

        }).catch((error) => {
          this.showSpinner = false;
          console.log('Error ', error);
          let event = new ShowToastEvent({
            title: "Error!",
            variant: "error",
            mode: "dismissable"
          });
          this.dispatchEvent(event);
        });
    }

  }

  getEmailVerificationResponse(event) {
    this.showSpinner = true;
    this.emailVerifyClicked = true;

    let email = this.emailval;
    let css =
      "slds-text-body--small slds-p-right_small slds-p-top_xx-small slds-p-bottom_x-small ";
    let message = "";
    let eStyle = "";
    let iconName = "";
    let variant = "";
    let status;
    //console.log('email val',this.emailval);
    //console.log('correctformat',this.emailCorrectFormat);
    if (this.emailCorrectFormat == false) {
      this.emailVerificationMessage = "Please Enter a correctly Formatted Email Address";
      this.emailVerificationIconName = "utility:clear";
      this.emailVerificationVariant = "error";
      this.emailVerificationStyle = css + "verification-message_error";
      this.emailDateDetails = "";
      this.disableSaveBtn = true;
      this.showSpinner = false;
    }
    else if (this.emailCorrectFormat) {
      getEmailWebServiceInterface()
        .then((result) => {
          const date = new Date();
          let todayDate = date
            .toLocaleDateString("en-GB", {
              day: "numeric",
              month: "numeric",
              year: "numeric"
            })
            .replace(/ /g, "/");
          const url = result["url"];
          const params = {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Auth-Token": result["authToken"]
            },
            body:
              '{"email":"' +
              email +
              '", "timeout":' +
              result["timeout"] +
              "}"
          };

          fetch(url, params).then((response) => {
            this.statusCode = response.status;
            console.log("statusCode", this.statusCode);
            return response.json();
          })
            .then((jsonResponse) => {
              let responseData = jsonResponse["result"];
              let confidence = responseData["confidence"];
              switch (confidence) {
                case 'verified':
                  status = 'Verified';
                  message = 'Successfully verified as deliverable';
                  iconName = 'utility:success';
                  variant = 'success';
                  eStyle = css + 'verification-message_verified';
                  this.validEmail = true;
                  break;
                case 'unreachable':
                  status = 'Unreachable';
                  message = 'Email is undeliverable';
                  iconName = 'utility:clear';
                  variant = 'error';
                  eStyle = css + 'verification-message_error';
                  this.validEmail = false;
                  break;
                case 'illegitimate':
                  status = 'Illegitimate';
                  message = 'Email is undeliverable';
                  iconName = 'utility:clear';
                  variant = 'error';
                  eStyle = css + 'verification-message_error';
                  this.validEmail = false;
                  break;
                case 'undeliverable':
                  status = 'Undeliverable';
                  message = 'Emails are unlikely to be delivered';
                  iconName = 'utility:warning';
                  variant = 'warning';
                  eStyle = css + 'verification-message_warning';
                  this.validEmail = false;
                  break;
                case 'disposable':
                  status = 'Disposable';
                  message = 'Email Address may not be in permanent use';
                  iconName = 'utility:warning';
                  variant = 'warning';
                  eStyle = css + 'verification-message_warning';
                  this.validEmail = false;
                  break;
                case 'unknown':
                  status = 'Unknown';
                  message = 'Email not completely verified, but it may be correct';
                  iconName = 'utility:success';
                  variant = 'brand';
                  eStyle = css + 'verification-message_bare';
                  this.validEmail = true;
                  break;
              }
              this.emailVerificationMessage = message;
              this.emailVerificationIconName = iconName;
              this.emailVerificationVariant = variant;
              this.emailVerificationStyle = eStyle;
              this.emailVerificationStatus = status;
              this.emailDateDetails = " (as at " + todayDate + ")";
              this.showSpinner = false;
              this.enableSaveButton();
            });

        }).catch((error) => {
          this.showSpinner = false;
          console.log('Error ', error);
          let event = new ShowToastEvent({
            title: "Error!",
            variant: "error",
            mode: "dismissable"
          });
          this.dispatchEvent(event);
        });
    }
  }

  enableSaveButton() {
    if (this.emailVerifyClicked && this.mobileVerifyClicked) {
      this.disableSaveBtn = !(this.validMobile && this.validEmail);
    } else
      if (this.emailVerifyClicked && !this.mobileVerifyClicked) {
        this.disableSaveBtn = (this.validEmail) ? false : true;
      } else
        if (this.mobileVerifyClicked && !this.emailVerifyClicked) {
          this.disableSaveBtn = (this.validMobile) ? false : true;
        } else
          this.disableSaveBtn = true;
  }

  mobileOnChange(event) {
    let mobile = (event.target.value);
    this.mobileval = mobile;
    this.disableSaveBtn = true;
    let replacedMobile = mobile.replace(/[+() ]/g, "");
    let allowedValues = /^[0-9()+ ]+$/g;
    let spaces = replacedMobile.split(" ").length - 1;
    if (
      replacedMobile.match(allowedValues) &&
      mobile.length >= 6 &&
      replacedMobile.length <= 40 &&
      spaces <= 1
    ) {
      this.mobileCorrectFormat = true;
      this.mobileEdited = true;
    } else { this.mobileCorrectFormat = false; }

  }

  emailOnChange(event) {
    let email = event.target.value;
    this.emailval = email;
    this.disableSaveBtn = true;
    let regexEmailFormat = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    if (
      email.match(regexEmailFormat) &&
      !email.startsWith(".")
    ) {
      this.emailCorrectFormat = true;
      this.emailEdited = true;
    } else {
      this.emailCorrectFormat = false;
    }
  }

  handleMobileReset(event) {
    this.mobileval = this.currentMobileValue;
    this.mobileVerifyClicked = false;
    this.validMobile = false;
    this.mobileCorrectFormat = true;
    this.mobileVerificationMessage = '';
    this.mobileVerificationIconName = '';
    this.mobileVerificationVariant = '';
    this.mobileVerificationStyle = '';
    this.mobileVerificationStatus = '';
    this.mobileDateDetails = '';
    this.enableSaveButton();
  }

  handleEmailReset(event) {
    this.emailval = this.currentEmailValue;
    this.emailVerifyClicked = false;
    this.emailCorrectFormat = true;
    this.validEmail = false;
    this.emailVerificationMessage = '';
    this.emailVerificationIconName = '';
    this.emailVerificationVariant = '';
    this.emailVerificationStyle = '';
    this.emailVerificationStatus = '';
    this.emailDateDetails = '';
    this.enableSaveButton();
  }

  handleSubmit(event) {
    this.showSpinner = true;
    event.preventDefault();
    var fields = event.detail.fields;
    if (this.mobileVerifyClicked && this.validMobile) fields['Mobile__c'] = this.mobileval;
    if (this.emailVerifyClicked && this.validEmail) fields['Email__c'] = this.emailval.toLowerCase();
    this.template.querySelector('lightning-record-edit-form').submit(fields);
  }

  handleError(event) {
    this.showSpinner = false;
    console.log('$$$ HandleError: ', JSON.parse(JSON.stringify(event.detail)));
  }

  handleSuccess(event) {
    this.showSpinner = false;
    let evt = new ShowToastEvent({
      title: "Success!",
      message: "Account successfully updated",
      variant: "success",
      mode: "dismissable"
    });
    this.dispatchEvent(evt);
  }
}
