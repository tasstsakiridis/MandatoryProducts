import { LightningElement, api, wire } from 'lwc';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

import getData from '@salesforce/apex/LinkMandatoryProducts_Controller.getData';
import linkProducts from '@salesforce/apex/LinkMandatoryProducts_Controller.linkProducts';
import unLinkProducts from '@salesforce/apex/LinkMandatoryProducts_Controller.unLinkProducts';

import OBJ_MANDATORY_PRODUCTS from '@salesforce/schema/Mandatory_Products__c';

import FLD_PRODUCT_STATUS from '@salesforce/schema/Mandatory_Products__c.Product_Status__c';

const columns = [
    { label: 'Product', fieldName: 'name' },
    { label: 'Status', fieldName: 'status' }
];

export default class LinkMandatoryProducts extends LightningElement {
    labels = {
        allproducts: { label: 'All products' },
        mandatory: { label: 'Mandatory' },
        show: { label: 'Show' }
    };

    @api
    recordId;

    isWorking;

    account;
    error;
    mandatoryProducts;
    allProducts;
    products;
    showingAllProducts = false;
    productStatus = 'Mandatory';
    productStatusOptions;

    data;
    columns = columns;

    get accountName() {
        return this.account == undefined ? '' : this.account.Name;
    }

    @wire(getObjectInfo, { objectApiName: OBJ_MANDATORY_PRODUCTS })
    objectInfo;

    get recordTypeId() {
        console.log('objectInfo', this.objectInfo);
        // Returns a map of record type Ids 
        if (this.objectInfo && this.objectInfo.data) {
            const rtis = this.objectInfo.data.recordTypeInfos;
            return Object.keys(rtis).find(rti => rtis[rti].name === 'Master');    
        } else {
            return '';
        }
    }

    @wire(getPicklistValues, { recordTypeId: '$recordTypeId', fieldApiName: FLD_PRODUCT_STATUS })
    getWiredProductStatusValues({error, data}) {
        console.log('picklistvalues', data);
        if (data) {
            this.error = undefined;            
            this.productStatusOptions = data.values;            
        } else if (error) {
            this.productStatusOptions = undefined;
            this.error = error;
        }
    }

    wiredData;
    @wire(getData, { accountId: '$recordId' })
    getWiredData(value) {
        this.wiredData = value;
        this.isWorking = false;
        console.log('[getWiredData] recordId', this.recordId);
        console.log('[getWiredData] data', value.data);
        console.log('[getWiredData] error', value.error);
        if (value.data) {
            try {
                this.error = undefined;
                this.account = value.data.account;
                this.allProducts = value.data.products;
                this.mandatoryProducts = value.data.mandatoryProducts;
                console.log('account', this.account);
                console.log('allproducts', this.allProducts);
                console.log('mandatoryproducts', this.mandatoryProducts);

                this.showingAllProducts = false;
                if (this.mandatoryProducts && this.mandatoryProducts.length > 0) {
                    this.data = this.mandatoryProducts.map(mp => {
                        return {
                            id: mp.Id,
                            name: mp.Product_Name__c,
                            productId: mp.Custom_Product__c,
                            status: mp.Product_Status__c
                        };
                    });                
                } else {
                    this.data = this.allProducts.map(p => {
                        return {
                            id: '',
                            name: p.Name,
                            productId: p.Id,
                            status: '',
                        };
                    });
                    this.showingAllProducts = true;
                }
                console.log('data', this.data);
            }catch(ex) {
                console.log('exception', ex);
            }
        } else if (value.error) {
            this.error = value.error;
            this.account = undefined;
            this.allProducts = undefined;
            this.mandatoryProducts = undefined;
        }
    }

    connectedCallback() {
        this.isWorking = true;        
    }

    handleProductStatusChange(ev) {
        this.productStatus = ev.detail.value;
        console.log('productStatus', this.productStatus);
    }
    handleBrandChange(ev) {
        this.selectedBrand = ev.detail.value;
        const filteredProducts = this.allProducts.filter(p => p.Brand__c == this.selectedBrand );
        this.products = [...filteredProducts];
    }

    toggleShownProducts(ev) {
        console.log('toggleShownProducts');
        this.isWorking = true;
        this.showingAllProducts = ev.detail.checked;
        if (this.showingAllProducts) {
            // Show all products
            let filteredProducts = this.allProducts;
            if (this.mandatoryProducts && this.mandatoryProducts.length > 0) {
                filteredProducts = this.allProducts.filter(p => !this.mandatoryProducts.find(mp => mp.Custom_Product__c == p.Id));                
            }
            console.log('filteredProducts', filteredProducts);
            this.data = filteredProducts.map(p => {
                return {
                    id: '',
                    name: p.Name,
                    productId: p.Id,
                    status: '',
                };
            });
        } else {
            // Show Mandatory products
            this.data = this.mandatoryProducts.map(mp => {                
                return {
                    id: mp.Id,
                    name: mp.Product_Name__c,
                    productId: mp.Custom_Product__c,
                    status: mp.Product_Status__c
                };
            });                
        }

        this.isWorking = false;
    }
    
    save(event) {
        this.isWorking = true;
        const selectedRows = this.template.querySelector('lightning-datatable').getSelectedRows();
        console.log('selectedRows', selectedRows);
        const ids = selectedRows.map(r => r.productId);
        console.log('ids', ids);
        linkProducts({accountId: this.recordId, productStatus: this.productStatus, productIds: ids })
            .then(result => {
                this.isWorking = false;
                this.data = result.mandatoryProducts.map(mp => {
                    return {
                        id: mp.Id,                        
                        name: mp.Product_Name__c,
                        productId: mp.Custom_Product__c
                    };
                });
                refreshApex(this.wiredData);
                if (result.status == 'OK') {
                    this.showToast('success', 'Success', 'All products linked');
                } else {
                    this.showToast('error', 'Warning', 'Error');
                }
            })
            .catch(error => {
                this.isWorking = false;
                this.error = error;
                this.showToast('error', 'Warning', error);
            });
    }
    unlink() {
        this.isWorking = true;
        const selectedRows = this.template.querySelector('lightning-datatable').getSelectedRows();
        console.log('selectedRows', selectedRows);
        if (selectedRows && selectedRows.length > 0) {
            const ids = selectedRows.map(r => r.id);
            console.log('ids', ids);
            unLinkProducts({accountId: this.recordId, ids: ids })
                .then(result => {
                    this.isWorking = false;
                    this.data = result.mandatoryProducts.map(mp => {
                        return {
                            id: mp.Id,                        
                            name: mp.Product_Name__c,
                            productId: mp.Custom_Product__c
                        };
                    });
                    if (result.status == 'OK') {
                        this.showToast('success', 'Success', 'Selected products removed');
                    } else {
                        this.showToast('error', 'Warning', 'Error');
                    }
                })
                .catch(error => {
                    this.isWorking = false;
                    this.error = error;
                    this.showToast('error', 'Warning', error);
                });
        }

    }

    showToast(type, title, msg) {
        console.log('[showToast] type', type, title, msg);
        try {
        var toastMessage = msg;
        if (Array.isArray(msg)) {
            toastMessage = '';
            msg.forEach(m => {
                toastMessage += m + '\n';
            });
        }
        const event = new ShowToastEvent({
            title: title,
            message: toastMessage,
            variant: type
        });

        this.dispatchEvent(event);
        }catch(ex) {
            console.log('[showToast] exception', ex);
        }   
    }

}