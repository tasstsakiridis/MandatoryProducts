public with sharing class LinkMandatoryProducts_Controller {
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getData(String accountId){
        try {
            Map<String, Object> result = new Map<String, Object>();

            Account account = [SELECT Id, Name, Market__c FROM Account WHERE Id =:accountId];
            result.put('account', account);

            String marketId = account.Market__c;
            if (String.isEmpty(account.Market__c)) {
                List<Market__c> markets = [SELECT Id FROM Market__c WHERE Name = 'Australia' LIMIT 1];
                marketId = markets[0].Id;
            }

            List<Product__c> products = [SELECT Id, Name 
                                           FROM Product__c 
                                          WHERE Market__c =:marketId
                                       ORDER BY Name];
            result.put('products', products);

            List<Mandatory_Products__c> mandatoryProducts = [SELECT Id, Custom_Product__c, Product_Name__c, Product_Status__c, 
                                                Listing_In__c, Listing_Out__c
                                          FROM Mandatory_Products__c
                                         WHERE Account__c =:accountId
                                      ORDER BY Product_Name__c];
            result.put('mandatoryProducts', mandatoryProducts);
             
            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }

    }

    @AuraEnabled
    public static Map<String, Object> linkProducts(String accountId, String productStatus, List<String> productIds){
        try {
            List<String> childAccountIds = new List<String>();

            Account theAccount = [SELECT Id, Name, RecordTypeId, RecordType.Name FROM Account WHERE Id =:accountId];
            List<Account> childAccounts;
            if (theAccount.RecordType.Name == 'Parent') {
                childAccounts = [SELECT Id FROM Account WHERE Id =:accountId OR ParentId =:accountId];
                for(Account a : childAccounts) {
                    childAccountIds.add(a.Id);
                }                

            } else {
                childAccountIds.add(accountId);   
                childAccounts = [SELECT Id FROM Account WHERE Id =:accountId];             
            }

            List<Mandatory_Products__c> existingMP = [SELECT Account__c, Id, Custom_Product__c, Product_Status__c 
                                                        FROM Mandatory_Products__c
                                                        WHERE Account__c =:childAccountIds];

            Boolean found = false;
            Map<String, Object> result = new Map<String, Object>();
            List<Mandatory_Products__c> mandatoryProducts = new List<Mandatory_Products__c>();
            for(Account a : childAccounts) {

                for(String id : productIds) {
                    found = false;
                    for(Mandatory_Products__c mp : existingMP) {
                        if (mp.Account__c == a.Id && mp.Custom_Product__c == id) {
                            mp.Product_Status__c = productStatus;
                            mandatoryProducts.add(mp);
                            found = true; break;
                        }
                    }
                    if (!found) {
                        Mandatory_Products__c mp = new Mandatory_Products__c();
                        mp.Account__c = a.Id;
                        mp.Custom_Product__c = id;
                        mp.Product_Status__c = productStatus;
        
                        mandatoryProducts.add(mp);    
                    }
                }
            }
            if (mandatoryProducts.size() > 0) {
                upsert mandatoryProducts;
            }

            mandatoryProducts = [SELECT Id, Custom_Product__c, Product_Name__c, Product_Status__c, 
                                        Listing_In__c, Listing_Out__c
                                    FROM Mandatory_Products__c
                                    WHERE Account__c =:accountId
                                ORDER BY Product_Name__c];

            result.put('mandatoryProducts', mandatoryProducts);
            result.put('status', 'OK');
            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Map<String, Object> unLinkProducts(String accountId, List<String> ids){
        try {
            List<Mandatory_Products__c> toDelete = [SELECT Id, Account__c, Custom_Product__c, Product_Status__c 
                                                        FROM Mandatory_Products__c
                                                        WHERE Id =:ids];

            if (toDelete.size() > 0) {
                delete toDelete;
            }

            List<Mandatory_Products__c> mandatoryProducts = [SELECT Id, Account__c, Custom_Product__c, Product_Name__c, Product_Status__c 
                                                                FROM Mandatory_Products__c 
                                                                WHERE Account__c =:accountId];

            Map<String, Object> result = new Map<String, Object>();
            result.put('mandatoryProducts', mandatoryProducts);
            result.put('status', 'OK');
            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }    
}