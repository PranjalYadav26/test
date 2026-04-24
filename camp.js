({
    doInit : function(component, event, helper) {
        var workspace = component.find('workspace');
        workspace.isConsoleNavigation()
        .then(function(response) {
            component.set('v.isConsoleNav', response);
        });

        workspace.getTabInfo().then(function(response) {
            var currentTabId = response.tabId;
            component.set('v.tabId', currentTabId);
            workspace.setTabLabel({
                tabId: currentTabId,
                label: component.get('v.button')
            });
            workspace.setTabIcon({
                tabId: currentTabId,
                icon: "utility:call",
                iconAlt: "Call List"
            });
        })
	
    var page = component.get('v.page');
    helper.getCampaignDetails(component);
    helper.checkButtonType(component);       
   	helper.getLoggedInUser(component);
    helper.clearFilter(component);
	},
	
    addFilter : function(component,event){
        var fil = component.get('v.filter');
        const max = component.get('v.maxFilter');
       	var length =  fil.length;
        if (length < max) {
        var newEle = {
            'Id' : 'filter'+length,
            'field' : '',
            'value' : '',
            'type'  : '',
        }; 
        fil.push(newEle);        
        component.set('v.filter',fil); 
    	}
    },
    
    removeFilter : function(component,event){
        var fil = component.get('v.filter');
        fil.splice(event.currentTarget.dataset.ivar, 1);       
        component.set('v.filter',fil); 
    },
    
    handleClearFilter : function(component,event,helper){
        document.getElementById('filterErrorMsg').innerHTML='';
		helper.clearFilter(component);
        helper.resetPage(component);
        helper.getCampaignMembers(component,null);
    },
    
	submitFilter : function(component,event,helper){
        var v = component.get('v.filter');
        var vlength = v.length;
		var pick = component.get('v.filterFieldsPicklist');            
        var fAndV = [];
        var selectedFields = [];
        var hasEmptyValue=false;
        document.getElementById('filterErrorMsg').innerHTML='';
        
        //checking repeating fields and empty values with fields selected
        for (var i = 0 ; i< vlength; i ++) {           
            selectedFields.push(v[i].field);
            if (v[i].field !='' && v[i].value===''){
                hasEmptyValue = true;
            }
        }
		//returns the field that is duplicated
        var dupFields = selectedFields.filter((s => v => s.has(v) || !s.add(v))(new Set));       
        if (dupFields.length != 0){
            document.getElementById('filterErrorMsg').innerHTML='Cannot have duplicate fields in Search';
        } else if (hasEmptyValue) {
            document.getElementById('filterErrorMsg').innerHTML=
                'Please ensure all selected fields have field values to search for'; 
        }
        else {
            //formating query string to apex code: 
            //format into a string array to be processed in apex
            //format of string array : FieldAPI[0],FieldValue[0],FieldDatatype[0],FieldAPI[1]... 
            for (var i = 0 ; i < vlength ; i++){
                if (v[i].field !=='') {               
                    fAndV.push(v[i].field);
                    fAndV.push(v[i].value);
                    for (var j = 0; j < pick.length ; j ++){
                        //checking datatype of selected picklist value break if field found
                        if (pick[j].value === v[i].field){ 
                            fAndV.push(pick[j].datatype);
                            break;
                        }
                    }                       
                }
            }       
            console.log('Query values for apex ',fAndV);
            helper.resetPage(component);
            helper.getCampaignMembers(component,fAndV);
        }
    },
     
    handleRefresh : function(component,event,helper){
       $A.get('e.force:refreshView').fire();
       helper.resetPage(component);
    },
	
    handleSort : function(component,event,helper){
        var sortedBy = event.getParam('fieldName');
        var sortDirection = event.getParam('sortDirection');

        component.set('v.sortDirection',sortDirection);
        component.set('v.sortedBy',sortedBy);
        helper.sortData(component);
    },
    
    handleSearch : function(component,event,helper){
        var data = component.get("v.allDataTemp"),
            term = component.get("v.search"),
            results = data, regex;
        try {
            regex = new RegExp(term, "i");
            // filter checks each row, constructs new array where function returns true
            results = data.filter(row=>regex.test(row.Financial_Account__r_FinServ__FinancialAccountNumber__c) || regex.test(row.Preferred_Phone_Number__c) || regex.test(row.ContactId__r_Name));
        } catch(e) {
            // invalid regex, use full list
            console.log(e);
        }
        component.set("v.allData", results);
        helper.pagination(component);
    },

    updateSelectedRows : function(component,event){
      	component.set('v.selectedDataRows',event.getParam('selectedRows'));
    },
		
    updateAssignee : function(component,event,helper){
		var assignee = component.get('v.Assignee.Id');
        console.log('assignee ',assignee);
        var selectedCMs = component.get('v.selectedDataRows');
        var uL =  component.find('userLookup');

        document.getElementById('userSearchError').innerHTML='';
        $A.util.removeClass(uL, 'slds-has-error');

        if(assignee === null) {
        	document.getElementById('userSearchError').innerHTML='Please select an Active User';
        	$A.util.addClass(uL, 'slds-has-error');
        }else if(selectedCMs.length===0){
        	helper.showToast(component,'Error','Please Select atleast one Campaign Member to Update','Error','dismissible');
        }else {
   			helper.updateAssigneeWithSelectedUser(component,assignee,selectedCMs);
        }
    },

    handleRowAction : function(component,event,helper){
        var campStatus = component.get('v.taskRelatedToCampaign').Status;
        var action = event.getParam('action');
        var row = event.getParam('row');
        component.set('v.attempts',row.Number_of_Interaction__c); 
        console.log(campStatus);
        console.log(row);
        //Functionality only available for non completed campaigns
        if (campStatus!='Completed' && campStatus!='Aborted' && campStatus!='Cancelled'){
            switch (action.name) {
                    // Call log button - open call log modal
                case 'callLog':
                    helper.prepareCallLogFields(component,row);
                    helper.openCallLogModal(component);
                    break;
                    // Customer Name Button  - navigate to campaign member tab
                case 'Customer Name':
                    helper.navigateToSubTab(component,row.Id);
                    break;
                    // Financial Account Button -  navigates to Financial Account 
                    // Used in both AU Customer Solutions and Adviser Support
                case 'FinancialAccount':
                    helper.navigateToSubTab(component,row.Financial_Account__c);
                    break;
                    // Contact Number Button - navigates to Contact
                case 'ContactNumber' :
                    helper.navigateToSubTab(component,row.ContactId__c);
                    break;
                    // Adviser Support button and actions    
                    // Update status button - updates last status to In progress 
                case 'updateStatus' :
                    console.log('update status');
                    helper.updateStatusButton(component,row.Id);
                    break;
                case 'logASM' :
                    console.log('ASM');
                    helper.callLogASM(component,row.ContactId__c);
                    break;
                case 'logBDM' :
                    console.log('BDM');
                    helper.callLogBDM(component,row.ContactId__c);
                    break;
                case 'Licensee':
                    helper.navigateToSubTab(component,row.ContactId__r.Account.Licensee__c);  
                    break;
                case 'PlannerName':
                    helper.navigateToSubTab(component,row.ContactId__r.AccountId__c);
                    break;
                default:
                    break;
            }
        }
    },

    handleModalClose : function(component,event,helper){
        var from = 'callLogForm';
        if (from === 'callLogForm'){
            helper.closeCallLogModal(component);
        }
    },

    previousPage : function(component,event,helper){
        console.log('Previous Page');
        component.set('v.page',component.get('v.page')-1);
        console.log(component.get('v.page'));
        helper.displayCM(component);
    },

    nextPage: function(component,event,helper){
        console.log('Next Page');
    	component.set('v.page',component.get('v.page')+1);
        console.log(component.get('v.page'));
    	helper.displayCM(component);
	},
    
    showDeleteConfirmbox : function(component, event, helper) {
        component.set('v.operation', 'deletezeroattempt');
        component.set('v.header', 'Delete Confirmation');
        component.set('v.confirmMessage', 'Are you sure you want to delete all the records with attempt 0?');
        component.set('v.showConfirmBox', true);
    },

    showUpdateConfirmbox : function(component, event, helper) {
        var selectedCMs = component.get('v.selectedDataRows');
        if(selectedCMs.length===0){
        	helper.showToast(component,'Error','Please Select atleast one Campaign Member to Update','Error','dismissible');
        } else {
   			component.set('v.operation', 'updateoutcome');
        	component.set('v.header', 'Update Confirmation');
        	component.set('v.confirmMessage', 'Are you sure you want to update outcome \'Unable to Reach Contact\' on selected records?');
        	component.set('v.showConfirmBox', true);
        }
    },
    
    handleConfirm : function(component, event, helper) {
        const args = event.getParams();
        if(args.isConfimed){
            component.set('v.showConfirmBox', false);
            component.set('v.showSpinner',true);
            if(args.operation == 'deletezeroattempt'){
                helper.deleteZeroAttempt(component);
            }
            if(args.operation == 'updateoutcome'){
                helper.updateOutcome(component);
            }
        } else{
        	component.set('v.showConfirmBox', false);
        }
    }
 })
